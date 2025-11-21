use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageConfig {
    pub archive_dir: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SchedulerConfig {
    pub cron_expression: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Repository {
    pub id: String,
    pub url: String,
    pub credential_id: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Credential {
    pub id: String,
    pub username: String,
    pub password: String,
    pub ssh_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub username: String,
    pub password_hash: String,
}

impl Config {
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let contents = fs::read_to_string(path)?;
        let config: Config = serde_yaml::from_str(&contents)?;
        Ok(config)
    }

    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<(), Box<dyn std::error::Error>> {
        let contents = serde_yaml::to_string(self)?;
        fs::write(path, contents)?;
        Ok(())
    }
}

impl Default for Config {
    fn default() -> Self {
        Config {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 8080,
                jwt_secret: "change-me-in-production".to_string(),
            },
            storage: StorageConfig {
                archive_dir: "./archives".to_string(),
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

#[cfg(test)]
#[path = "config_test.rs"]
mod config_test;
