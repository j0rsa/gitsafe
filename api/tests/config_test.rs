use gitsafe::config::*;

#[test]
fn test_default_config() {
    let config = Config::default();
    
    assert_eq!(config.server.host, "127.0.0.1");
    assert_eq!(config.server.port, 8080);
    assert_eq!(config.storage.archive_dir, "./archives");
    assert_eq!(config.repositories.len(), 0);
    assert_eq!(config.credentials.len(), 0);
    assert_eq!(config.users.len(), 0);
}

#[test]
fn test_config_serialization() {
    let mut config = Config::default();
    
    // Add a test user
    config.users.push(User {
        username: "test".to_string(),
        password_hash: "hash".to_string(),
    });
    
    // Add a repository
    config.repositories.push(Repository {
        id: "repo1".to_string(),
        url: "https://github.com/test/repo.git".to_string(),
        credential_id: None,
        enabled: true,
        last_sync: None,
        error: None,
    });
    
    // Add a credential
    let cred = Credential {
        id: "cred1".to_string(),
        username: "user".to_string(),
        password: "pass".to_string(),
        ssh_key: None,
    };
    config.credentials.insert(cred.id.clone(), cred);
    
        // Serialize to YAML
        let yaml = serde_yaml_ng::to_string(&config).unwrap();
        
        // Deserialize back
        let deserialized: Config = serde_yaml_ng::from_str(&yaml).unwrap();
    
    assert_eq!(deserialized.users.len(), 1);
    assert_eq!(deserialized.users[0].username, "test");
    assert_eq!(deserialized.repositories.len(), 1);
    assert_eq!(deserialized.repositories[0].id, "repo1");
    assert_eq!(deserialized.credentials.len(), 1);
}

#[test]
fn test_repository_creation() {
    let repo = Repository {
        id: "test-id".to_string(),
        url: "https://github.com/test/repo.git".to_string(),
        credential_id: Some("cred-id".to_string()),
        enabled: true,
        last_sync: None,
        error: None,
    };
    
    assert_eq!(repo.id, "test-id");
    assert_eq!(repo.url, "https://github.com/test/repo.git");
    assert_eq!(repo.credential_id, Some("cred-id".to_string()));
    assert!(repo.enabled);
}

#[test]
fn test_credential_with_ssh_key() {
    let cred = Credential {
        id: "cred1".to_string(),
        username: "git".to_string(),
        password: "".to_string(),
        ssh_key: Some("/path/to/key".to_string()),
    };
    
    assert_eq!(cred.username, "git");
    assert_eq!(cred.ssh_key, Some("/path/to/key".to_string()));
}

#[test]
fn test_config_save_and_load() {
    use tempfile::NamedTempFile;
    
    let temp_file = NamedTempFile::new().unwrap();
    let path = temp_file.path();
    
    let mut config = Config::default();
    config.server.port = 9090;
    config.repositories.push(Repository {
        id: "repo1".to_string(),
        url: "https://example.com/repo.git".to_string(),
        credential_id: None,
        enabled: true,
        last_sync: None,
        error: None,
    });
    
    // Save config
    config.save(path).unwrap();
    
    // Load config
    let loaded_config = Config::load(path).unwrap();
    
    assert_eq!(loaded_config.server.port, 9090);
    assert_eq!(loaded_config.repositories.len(), 1);
    assert_eq!(loaded_config.repositories[0].id, "repo1");
}
