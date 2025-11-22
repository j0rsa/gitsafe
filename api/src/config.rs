use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use chrono::{DateTime, Utc};
use config::{Config as ConfigBuilder, ConfigError, Environment, File, FileFormat};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub server: ServerConfig,
    pub storage: StorageConfig,
    pub scheduler: SchedulerConfig,
    pub repositories: Vec<Repository>,
    pub credentials: HashMap<String, Credential>,
    pub users: Vec<User>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub jwt_secret: String,
    #[serde(default = "default_encryption_key")]
    pub encryption_key: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub error_webhooks: Vec<String>,
}

fn default_encryption_key() -> String {
    "change-me-in-production-use-a-long-random-string-for-encryption".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageConfig {
    pub archive_dir: String,
    #[serde(default = "default_compact")]
    pub compact: bool,
}

fn default_compact() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SchedulerConfig {
    pub cron_expression: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Repository {
    pub id: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential_id: Option<String>,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sync: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>, // Size in bytes
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Credential {
    pub id: String,
    pub username: String,
    pub password: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub username: String,
    pub password_hash: String,
}

impl Config {
    /// Load configuration from a YAML file with environment variable overrides.
    /// 
    /// Environment variables can override any config value using the format:
    /// `GITSAFE__<SECTION>__<FIELD>` (double underscore for nesting)
    /// 
    /// Examples:
    /// - `GITSAFE__SERVER__HOST=0.0.0.0` overrides `server.host`
    /// - `GITSAFE__SERVER__PORT=9090` overrides `server.port`
    /// - `GITSAFE__STORAGE__ARCHIVE_DIR=/tmp/archives` overrides `storage.archive_dir`
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, ConfigError> {
        let path_ref = path.as_ref();
        
        let mut builder = ConfigBuilder::builder();
        
        // Load from YAML file first (base configuration)
        if path_ref.exists() {
            builder = builder.add_source(File::from(path_ref).format(FileFormat::Yaml));
        }
        
        // Override with environment variables (higher priority, overrides file values)
        // Use GITSAFE__ prefix and double underscore (__) for nested fields
        builder = builder.add_source(Environment::with_prefix("GITSAFE").separator("__"));
        
        let config = builder.build()?;
        config.try_deserialize()
    }

    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<(), Box<dyn std::error::Error>> {
        let contents = serde_yaml_ng::to_string(self)?;
        fs::write(path, contents)?;
        Ok(())
    }

    pub fn get_credential(&self, id: &str) -> Option<&Credential> {
        self.credentials.get(id)
    }
}

impl Default for Config {
    fn default() -> Self {
        Config {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 8080,
                jwt_secret: "change-me-in-production".to_string(),
                encryption_key: default_encryption_key(),
                error_webhooks: Vec::new(),
            },
            storage: StorageConfig {
                archive_dir: "./archives".to_string(),
                compact: true,
            },
            scheduler: SchedulerConfig {
                cron_expression: "0 0 * * * *".to_string(), // Every hour
            },
            repositories: Vec::new(),
            credentials: HashMap::new(),
            users: Vec::new(),
        }
    }
}
