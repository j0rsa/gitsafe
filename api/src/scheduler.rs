use crate::config::Config;
use crate::config_persistence::ConfigPersistence;
use crate::git::GitService;
use crate::webhooks;
use log::{error, info};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler};

pub async fn setup_scheduler(
    config: Arc<RwLock<Config>>,
    git_service: Arc<GitService>,
    config_persistence: ConfigPersistence,
) -> Result<JobScheduler, Box<dyn std::error::Error>> {
    let scheduler = JobScheduler::new().await?;

    let cron_expression = {
        let cfg = config.read().await;
        cfg.scheduler.cron_expression.clone()
    };

    let job = Job::new_async(cron_expression.as_str(), move |_uuid, _l| {
        let config = Arc::clone(&config);
        let git_service = Arc::clone(&git_service);
        let config_persistence = config_persistence.clone();

        Box::pin(async move {
            info!("Starting scheduled sync");

            let cfg = config.read().await;
            let credentials = cfg.credentials.clone();
            let repositories = cfg.repositories.clone();
            let encryption_key = cfg.server.encryption_key.clone();
            let sync_attempts = cfg.server.sync_attempts;
            let webhook_urls = cfg.server.error_webhooks.clone();
            drop(cfg); // Release the lock

            for repo in repositories.iter().filter(|r| r.enabled) {
                let repo_clone = repo.clone();
                let credential = repo
                    .credential_id
                    .as_ref()
                    .and_then(|id| credentials.get(id).cloned());
                let encryption_key_clone = encryption_key.clone();
                let git_service_clone = git_service.clone();
                let config_clone = Arc::clone(&config);

                // Run the blocking sync operation in a blocking thread pool
                let sync_result = match tokio::task::spawn_blocking(move || {
                    git_service_clone.sync_repository(
                        &repo_clone,
                        credential.as_ref(),
                        &encryption_key_clone,
                    )
                })
                .await
                {
                    Ok(result) => result,
                    Err(e) => {
                        error!("Task join error for repository {}: {}", repo.id, e);
                        continue; // Skip this repository and continue with the next one
                    }
                };

                match sync_result {
                    Ok((archive_path, archive_size)) => {
                        info!(
                            "Successfully synced repository {}: {:?} ({} bytes)",
                            repo.id, archive_path, archive_size
                        );

                        // Update repository size and last_sync in config
                        let mut cfg = config_clone.write().await;
                        let config_to_save = if let Some(repo_mut) =
                            cfg.repositories.iter_mut().find(|r| r.id == repo.id)
                        {
                            repo_mut.size = Some(archive_size);
                            repo_mut.last_sync = Some(chrono::Utc::now());

                            // Reset attempts_left on successful sync (recovered from errors)
                            if repo_mut.attempts_left.is_some() {
                                info!(
                                    "Repository {} recovered from error spree, resetting attempts",
                                    repo_mut.id
                                );
                                repo_mut.attempts_left = None;
                            }
                            repo_mut.error = None;
                            Some(cfg.clone())
                        } else {
                            None
                        };
                        drop(cfg); // Release lock before async operation

                        // Request config save (non-blocking, debounced)
                        if let Some(config_data) = config_to_save {
                            config_persistence.request_save(config_data);
                        }
                    }
                    Err(e) => {
                        error!("Failed to sync repository {}: {}", repo.id, e);
                        let error_message = e.to_string();

                        // Notify webhooks about the error
                        webhooks::notify_error_webhooks(
                            &webhook_urls,
                            repo,
                            "sync",
                            repo.credential_id.as_ref(),
                            &error_message,
                        )
                        .await;

                        // Handle sync failure (update attempts_left, potentially disable repo)
                        let mut cfg = config_clone.write().await;
                        let (config_to_save, was_disabled, repo_for_webhook) =
                            if let Some(repo_mut) =
                                cfg.repositories.iter_mut().find(|r| r.id == repo.id)
                            {
                                // Initialize or decrement attempts_left
                                let attempts_left = if let Some(attempts) = repo_mut.attempts_left {
                                    if attempts > 0 {
                                        attempts - 1
                                    } else {
                                        0 // Already at 0, shouldn't happen but handle gracefully
                                    }
                                } else {
                                    // First failure: set to sync_attempts - 1
                                    sync_attempts - 1
                                };

                                repo_mut.attempts_left = Some(attempts_left);
                                repo_mut.error = Some(error_message.clone());

                                // Check if we've run out of attempts
                                let disabled = if attempts_left == 0 {
                                    // Reset attempts_left to None and disable the repository
                                    repo_mut.attempts_left = None;
                                    repo_mut.enabled = false;

                                    info!(
                                    "Repository {} ran out of sync attempts and has been disabled",
                                    repo_mut.id
                                );
                                    true
                                } else {
                                    false
                                };

                                // Clone repo for webhook (before dropping lock)
                                let repo_clone = repo_mut.clone();
                                // Clone config for async save
                                let config_clone = cfg.clone();
                                (Some(config_clone), disabled, Some(repo_clone))
                            } else {
                                (None, false, None)
                            };
                        drop(cfg); // Release lock before async operations

                        // Notify webhooks about running out of attempts (if disabled)
                        if was_disabled {
                            if let Some(repo_for_webhook) = repo_for_webhook {
                                webhooks::notify_out_of_attempts_webhooks(
                                    &webhook_urls,
                                    &repo_for_webhook,
                                    repo_for_webhook.credential_id.as_ref(),
                                    &error_message,
                                    sync_attempts,
                                )
                                .await;
                            }
                        }

                        // Request config save (non-blocking, debounced)
                        if let Some(config_data) = config_to_save {
                            config_persistence.request_save(config_data);
                        }
                    }
                }
            }

            info!("Scheduled sync completed");
        })
    })?;

    scheduler.add(job).await?;
    scheduler.start().await?;

    info!(
        "Scheduler started with cron expression: {}",
        cron_expression
    );
    Ok(scheduler)
}
