use chrono::{DateTime, Utc};
use config::{Config as ConfigBuilder, ConfigError, Environment, File, FileFormat};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Main application configuration structure.
///
/// Contains all configuration for the GitSafe application including server settings,
/// storage configuration, scheduler settings, repositories, credentials, and users.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    /// Server configuration (host, port, secrets)
    pub server: ServerConfig,
    /// Storage configuration (archive directory, compact mode)
    pub storage: StorageConfig,
    /// Scheduler configuration (cron expression)
    pub scheduler: SchedulerConfig,
    /// List of configured repositories
    pub repositories: Vec<Repository>,
    /// Map of credentials by ID
    pub credentials: HashMap<String, Credential>,
    /// List of application users
    pub users: Vec<User>,
}

/// Server configuration settings.
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
    /// Cron expression for scheduled repository syncing
    /// Format: "sec min hour day_of_month month day_of_week"
    pub cron_expression: String,
}

/// Repository configuration.
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
    /// Repository size in bytes (archive size or folder size)
    pub size: Option<u64>,
}

/// Git credential configuration for authenticated repository access.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Credential {
    pub id: String,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    /// Password (encrypted if stored, or plaintext for backward compatibility)
    pub password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    /// SSH private key content (encrypted if stored, or plaintext). Must be the actual key content, not a file path.
    pub ssh_key: Option<String>,
}

impl Credential {
    /// Creates a new `Credential` instance with validation.
    ///
    /// Ensures that at least one authentication method (password or SSH key) is provided.
    ///
    /// # Arguments
    ///
    /// * `id` - Unique identifier for the credential
    /// * `username` - Username for Git authentication
    /// * `password` - Optional password (encrypted or plaintext)
    /// * `ssh_key` - Optional SSH private key (encrypted or plaintext)
    ///
    /// # Returns
    ///
    /// Returns `Ok(Credential)` if at least one of password or SSH key is provided,
    /// or `Err(AppError::BadRequest)` if both are missing.
    ///
    /// # Errors
    ///
    /// Returns `AppError::BadRequest` if both password and SSH key are `None`.
    ///
    /// # Example
    ///
    /// ```
    /// use gitsafe::config::Credential;
    /// use gitsafe::error::AppError;
    ///
    /// // Valid: password provided
    /// let cred = Credential::try_new(
    ///     "cred-1".to_string(),
    ///     "user".to_string(),
    ///     Some("password".to_string()),
    ///     None,
    /// )?;
    ///
    /// // Valid: SSH key provided
    /// let cred = Credential::try_new(
    ///     "cred-2".to_string(),
    ///     "git".to_string(),
    ///     None,
    ///     Some("ssh-key-content".to_string()),
    /// )?;
    ///
    /// // Invalid: both missing
    /// let result = Credential::try_new(
    ///     "cred-3".to_string(),
    ///     "user".to_string(),
    ///     None,
    ///     None,
    /// );
    /// assert!(result.is_err());
    /// # Ok::<(), AppError>(())
    /// ```
    pub fn try_new(
        id: String,
        username: String,
        password: Option<String>,
        ssh_key: Option<String>,
    ) -> Result<Self, crate::error::AppError> {
        if password.is_none() && ssh_key.is_none() {
            return Err(crate::error::AppError::BadRequest(
                "At least one of password or SSH key must be provided".to_string(),
            ));
        }

        Ok(Credential {
            id,
            username,
            password,
            ssh_key,
        })
    }
}

/// Application user configuration.
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
        // Build config using default values, but allow env overrides (like in load)
        let defaults = Config {
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
        };

        // Serialize defaults to YAML and add as a config source
        let yaml_string = match serde_yaml_ng::to_string(&defaults) {
            Ok(yaml) => yaml,
            Err(_) => return defaults, // If serialization fails, return defaults directly
        };

        let mut builder = ConfigBuilder::builder();

        // Add defaults from YAML string
        builder = builder.add_source(File::from_str(&yaml_string, FileFormat::Yaml));

        // Apply environment overrides (same as in load)
        builder = builder.add_source(Environment::with_prefix("GITSAFE").separator("__"));

        // Try to merge all and return
        builder
            .build()
            .and_then(|c| c.try_deserialize())
            .unwrap_or(defaults)
    }
}
