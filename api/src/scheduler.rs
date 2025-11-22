use crate::config::Config;
use crate::git::GitService;
use crate::webhooks;
use log::{error, info};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler};

pub async fn setup_scheduler(
    config: Arc<RwLock<Config>>,
    git_service: Arc<GitService>,
) -> Result<JobScheduler, Box<dyn std::error::Error>> {
    let scheduler = JobScheduler::new().await?;

    let cron_expression = {
        let cfg = config.read().await;
        cfg.scheduler.cron_expression.clone()
    };

    let job = Job::new_async(cron_expression.as_str(), move |_uuid, _l| {
        let config = Arc::clone(&config);
        let git_service = Arc::clone(&git_service);

        Box::pin(async move {
            info!("Starting scheduled sync");

            let cfg = config.read().await;
            let credentials = cfg.credentials.clone();
            let repositories = cfg.repositories.clone();
            let encryption_key = cfg.server.encryption_key.clone();
            drop(cfg); // Release the lock

            for repo in repositories.iter().filter(|r| r.enabled) {
                let credential = repo
                    .credential_id
                    .as_ref()
                    .and_then(|id| credentials.get(id));

                match git_service.sync_repository(repo, credential, &encryption_key) {
                    Ok((archive_path, archive_size)) => {
                        info!(
                            "Successfully synced repository {}: {:?} ({} bytes)",
                            repo.id, archive_path, archive_size
                        );
                        
                        // Update repository size and last_sync in config
                        let mut cfg = config.write().await;
                        if let Some(repo_mut) = cfg.repositories.iter_mut().find(|r| r.id == repo.id) {
                            repo_mut.size = Some(archive_size);
                            repo_mut.last_sync = Some(chrono::Utc::now());
                            repo_mut.error = None;
                            // Note: We don't save here to avoid blocking the scheduler
                            // The config will be saved on the next manual operation
                        }
                    }
                    Err(e) => {
                        error!("Failed to sync repository {}: {}", repo.id, e);
                        
                        // Get webhook URLs before mutable borrow
                        let webhook_urls = {
                            let cfg = config.read().await;
                            cfg.server.error_webhooks.clone()
                        };
                        
                        // Notify webhooks about the error
                        webhooks::notify_error_webhooks(
                            &webhook_urls,
                            repo,
                            "sync",
                            repo.credential_id.as_ref(),
                            &e.to_string(),
                        )
                        .await;
                        
                        // Update error in config
                        let mut cfg = config.write().await;
                        if let Some(repo_mut) = cfg.repositories.iter_mut().find(|r| r.id == repo.id) {
                            repo_mut.error = Some(e.to_string());
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
