use crate::config::Config;
use crate::git::GitService;
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
            drop(cfg); // Release the lock

            for repo in repositories.iter().filter(|r| r.enabled) {
                let credential = repo
                    .credential_id
                    .as_ref()
                    .and_then(|id| credentials.get(id));

                match git_service.sync_repository(repo, credential) {
                    Ok(archive_path) => {
                        info!(
                            "Successfully synced repository {}: {:?}",
                            repo.id, archive_path
                        );
                    }
                    Err(e) => {
                        error!("Failed to sync repository {}: {}", repo.id, e);
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
