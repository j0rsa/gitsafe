use crate::config::{Credential, Repository};
use crate::error::AppError;
use flate2::write::GzEncoder;
use flate2::Compression;
use git2::{build::RepoBuilder, Cred, FetchOptions, RemoteCallbacks};
use log::{info, warn};
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use tar::Builder;

#[derive(Clone)]
pub struct GitService {
    archive_dir: PathBuf,
}

impl GitService {
    pub fn new<P: AsRef<Path>>(archive_dir: P) -> Result<Self, AppError> {
        let archive_dir = archive_dir.as_ref().to_path_buf();
        fs::create_dir_all(&archive_dir)?;
        Ok(GitService { archive_dir })
    }

    pub fn sync_repository(
        &self,
        repo: &Repository,
        credential: Option<&Credential>,
    ) -> Result<PathBuf, AppError> {
        info!("Syncing repository: {} ({})", repo.id, repo.url);

        let temp_dir = tempfile::tempdir()
            .map_err(|e| AppError::IoError(e))?;
        let repo_path = temp_dir.path();

        // Set up callbacks for authentication
        let mut callbacks = RemoteCallbacks::new();
        
        if let Some(cred) = credential {
            let username = cred.username.clone();
            let password = cred.password.clone();
            let ssh_key = cred.ssh_key.clone();

            callbacks.credentials(move |_url, username_from_url, _allowed_types| {
                if let Some(ref key_path) = ssh_key {
                    Cred::ssh_key(
                        username_from_url.unwrap_or(&username),
                        None,
                        Path::new(key_path),
                        None,
                    )
                } else {
                    Cred::userpass_plaintext(&username, &password)
                }
            });
        }

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        let mut builder = RepoBuilder::new();
        builder.fetch_options(fetch_options);

        // Clone the repository
        match builder.clone(&repo.url, repo_path) {
            Ok(_) => {
                info!("Successfully cloned repository: {}", repo.id);
            }
            Err(e) => {
                warn!("Failed to clone repository {}: {}", repo.id, e);
                return Err(AppError::GitError(e.to_string()));
            }
        }

        // Create tarball
        let archive_path = self.create_archive(&repo.id, repo_path)?;
        
        info!("Created archive: {:?}", archive_path);
        Ok(archive_path)
    }

    fn create_archive(&self, repo_id: &str, repo_path: &Path) -> Result<PathBuf, AppError> {
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let archive_name = format!("{}_{}.tar.gz", repo_id, timestamp);
        let archive_path = self.archive_dir.join(&archive_name);

        let tar_gz = File::create(&archive_path)?;
        let enc = GzEncoder::new(tar_gz, Compression::default());
        let mut tar = Builder::new(enc);

        tar.append_dir_all(repo_id, repo_path)
            .map_err(|e| AppError::IoError(e))?;
        
        tar.finish()
            .map_err(|e| AppError::IoError(e))?;

        Ok(archive_path)
    }

    pub fn list_archives(&self) -> Result<Vec<String>, AppError> {
        let mut archives = Vec::new();
        
        for entry in fs::read_dir(&self.archive_dir)? {
            let entry = entry?;
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".tar.gz") {
                    archives.push(name.to_string());
                }
            }
        }

        archives.sort();
        archives.reverse(); // Most recent first
        Ok(archives)
    }
}
