use crate::config::Config;
use log::{debug, error, info};
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};

/// Manages config persistence with debouncing to prevent excessive file I/O.
///
/// All config saves go through a single background task that:
/// 1. Queues save requests
/// 2. Debounces rapid changes (waits 100ms after last change)
/// 3. Saves the latest config state atomically
///
/// This ensures no race conditions and efficient I/O.
#[derive(Clone)]
pub struct ConfigPersistence {
    sender: mpsc::UnboundedSender<Config>,
}

impl ConfigPersistence {
    /// Creates a new ConfigPersistence manager and starts the background task.
    ///
    /// # Arguments
    ///
    /// * `config_path` - Path to the config file to save to
    ///
    /// # Returns
    ///
    /// Returns a `ConfigPersistence` handle that can be used to request saves.
    pub fn new(config_path: String) -> Self {
        let (sender, receiver) = mpsc::unbounded_channel();

        // Spawn background task to handle saves
        tokio::spawn(Self::persistence_task(receiver, config_path));

        Self { sender }
    }

    /// Requests a config save. The save will be debounced and executed by the background task.
    ///
    /// This method is non-blocking and returns immediately.
    ///
    /// # Arguments
    ///
    /// * `config` - The config to save
    pub fn request_save(&self, config: Config) {
        if let Err(e) = self.sender.send(config) {
            error!("Failed to queue config save request: {}", e);
        }
    }

    /// Background task that processes save requests with debouncing.
    ///
    /// Waits for a quiet period (100ms) after the last save request before
    /// actually writing to disk. This batches rapid changes efficiently.
    async fn persistence_task(mut receiver: mpsc::UnboundedReceiver<Config>, config_path: String) {
        const DEBOUNCE_DELAY: Duration = Duration::from_millis(500);
        let mut pending_config: Option<Config> = None;
        let mut debounce_timer: Option<tokio::time::Sleep> = None;

        loop {
            tokio::select! {
                // Receive new save request
                config_opt = receiver.recv() => {
                    match config_opt {
                        Some(config) => {
                            // Update pending config (only keep latest)
                            pending_config = Some(config);
                            // Reset debounce timer
                            debounce_timer = Some(sleep(DEBOUNCE_DELAY));
                        }
                        None => {
                            // Channel closed, flush any pending save and exit
                            if let Some(config) = pending_config.take() {
                                Self::save_config(&config, &config_path).await;
                            }
                            info!("Config persistence task shutting down");
                            break;
                        }
                    }
                }
                // Debounce timer: save after quiet period
                _ = async {
                    if let Some(timer) = debounce_timer.take() {
                        tokio::pin!(timer);
                        timer.await
                    } else {
                        // This branch should never be selected if debounce_timer is None
                        // but we need to satisfy the compiler
                        std::future::pending().await
                    }
                }, if debounce_timer.is_some() => {
                    if let Some(config) = pending_config.take() {
                        Self::save_config(&config, &config_path).await;
                    }
                    debounce_timer = None;
                }
            }
        }
    }

    /// Saves the config to disk atomically.
    ///
    /// Uses a temporary file and rename to ensure atomic writes.
    async fn save_config(config: &Config, config_path: &str) {
        // Run blocking file I/O in a blocking thread pool
        let config_clone = config.clone();
        let path_clone = config_path.to_string();

        match tokio::task::spawn_blocking(move || {
            // Create temporary file path
            let temp_path = format!("{}.tmp", path_clone);

            // Write to temporary file
            match config_clone.save(&temp_path) {
                Ok(()) => {
                    // Atomically rename temp file to final location
                    match std::fs::rename(&temp_path, &path_clone) {
                        Ok(()) => Ok(()),
                        Err(e) => {
                            // Clean up temp file on error
                            let _ = std::fs::remove_file(&temp_path);
                            Err(format!("Failed to rename temp config file: {}", e))
                        }
                    }
                }
                Err(e) => {
                    // Clean up temp file on error
                    let _ = std::fs::remove_file(&temp_path);
                    Err(format!("Failed to write config to temp file: {}", e))
                }
            }
        })
        .await
        {
            Ok(Ok(())) => {
                debug!("Config saved successfully to {}", config_path);
            }
            Ok(Err(e)) => {
                error!("Failed to save config: {}", e);
            }
            Err(e) => {
                error!("Task join error while saving config: {}", e);
            }
        }
    }
}
