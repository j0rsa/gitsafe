use crate::config::Repository;
use chrono::Utc;
use log::warn;
use serde::Serialize;

/// Payload sent to error webhooks when a sync operation fails.
#[derive(Debug, Serialize, Clone)]
pub struct ErrorWebhookPayload {
    /// Timestamp when the error occurred (ISO 8601 format)
    pub time: String,
    /// Repository information
    pub repo: RepoInfo,
    /// Operation that failed (e.g., "sync", "clone", "pull")
    pub operation: String,
    /// Credential ID used for the operation (if any)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential_id: Option<String>,
    /// Error message describing what went wrong
    pub error_message: String,
}

/// Repository information included in webhook payloads.
#[derive(Debug, Serialize, Clone)]
pub struct RepoInfo {
    /// Repository ID
    pub id: String,
    /// Repository URL
    pub url: String,
    /// Whether the repository is enabled
    pub enabled: bool,
}

/// Sends error notifications to configured webhooks.
///
/// This function sends HTTP POST requests to all configured webhook URLs
/// with error details. Failures to send webhooks are logged but do not
/// affect the main error handling flow.
///
/// # Arguments
///
/// * `webhook_urls` - List of webhook URLs to notify
/// * `repo` - The repository that encountered the error
/// * `operation` - The operation that failed (e.g., "sync", "clone", "pull")
/// * `credential_id` - Optional credential ID used for the operation
/// * `error_message` - The error message
pub async fn notify_error_webhooks(
    webhook_urls: &[String],
    repo: &Repository,
    operation: &str,
    credential_id: Option<&String>,
    error_message: &str,
) {
    if webhook_urls.is_empty() {
        return;
    }

    let payload = ErrorWebhookPayload {
        time: Utc::now().to_rfc3339(),
        repo: RepoInfo {
            id: repo.id.clone(),
            url: repo.url.clone(),
            enabled: repo.enabled,
        },
        operation: operation.to_string(),
        credential_id: credential_id.cloned(),
        error_message: error_message.to_string(),
    };

    for webhook_url in webhook_urls {
        let url = webhook_url.clone();
        let payload = payload.clone();

        tokio::spawn(async move {
            let client = reqwest::Client::new();
            match client
                .post(&url)
                .json(&payload)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await
            {
                Ok(response) => {
                    if !response.status().is_success() {
                        warn!(
                            "Webhook {} returned status {}: {}",
                            url,
                            response.status(),
                            response.text().await.unwrap_or_default()
                        );
                    }
                }
                Err(e) => {
                    warn!("Failed to send webhook to {}: {}", url, e);
                }
            }
        });
    }
}
