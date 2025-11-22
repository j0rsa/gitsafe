use gitsafe::config::Repository;
use gitsafe::webhooks::{ErrorWebhookPayload, RepoInfo};
use chrono::Utc;

#[test]
fn test_error_webhook_payload_serialization() {
    let repo = Repository {
        id: "test-repo".to_string(),
        url: "https://github.com/user/repo.git".to_string(),
        credential_id: Some("cred-123".to_string()),
        enabled: true,
        last_sync: Some(Utc::now()),
        error: None,
        size: Some(1024),
    };

    let payload = ErrorWebhookPayload {
        time: Utc::now().to_rfc3339(),
        repo: RepoInfo {
            id: repo.id.clone(),
            url: repo.url.clone(),
            enabled: repo.enabled,
        },
        operation: "sync".to_string(),
        credential_id: repo.credential_id.clone(),
        error_message: "Failed to clone repository".to_string(),
    };

    let json = serde_json::to_string(&payload).unwrap();
    assert!(json.contains("test-repo"));
    assert!(json.contains("sync"));
    assert!(json.contains("Failed to clone repository"));
    assert!(json.contains("cred-123"));
    assert!(json.contains("time"));
    assert!(json.contains("repo"));
    assert!(json.contains("operation"));
    assert!(json.contains("credential_id"));
    assert!(json.contains("error_message"));
}

#[test]
fn test_error_webhook_payload_without_credential() {
    let repo = Repository {
        id: "test-repo-2".to_string(),
        url: "https://gitlab.com/user/repo.git".to_string(),
        credential_id: None,
        enabled: false,
        last_sync: None,
        error: None,
        size: None,
    };

    let payload = ErrorWebhookPayload {
        time: Utc::now().to_rfc3339(),
        repo: RepoInfo {
            id: repo.id.clone(),
            url: repo.url.clone(),
            enabled: repo.enabled,
        },
        operation: "pull".to_string(),
        credential_id: None,
        error_message: "Merge conflicts detected".to_string(),
    };

    let json = serde_json::to_string(&payload).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    
    assert_eq!(parsed["repo"]["id"], "test-repo-2");
    assert_eq!(parsed["operation"], "pull");
    assert_eq!(parsed["error_message"], "Merge conflicts detected");
    assert_eq!(parsed["repo"]["enabled"], false);
    // credential_id should not be present in JSON when None
    assert!(parsed.get("credential_id").is_none());
}

#[test]
fn test_repo_info_serialization() {
    let repo_info = RepoInfo {
        id: "repo-123".to_string(),
        url: "https://github.com/example/repo".to_string(),
        enabled: true,
    };

    let json = serde_json::to_string(&repo_info).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    
    assert_eq!(parsed["id"], "repo-123");
    assert_eq!(parsed["url"], "https://github.com/example/repo");
    assert_eq!(parsed["enabled"], true);
}

#[tokio::test]
async fn test_notify_error_webhooks_empty_list() {
    let repo = Repository {
        id: "test".to_string(),
        url: "https://github.com/test/repo".to_string(),
        credential_id: None,
        enabled: true,
        last_sync: None,
        error: None,
        size: None,
    };

    // Should not panic or error with empty webhook list
    gitsafe::webhooks::notify_error_webhooks(&[], &repo, "sync", None, "test error").await;
}

