use crate::config::{Credential, Repository};
use crate::encryption;
use crate::error::AppError;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use git2::{
    build::RepoBuilder, Cred, CredentialType, FetchOptions, RemoteCallbacks,
    Repository as GitRepository,
};
use log::info;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use tar::{Archive, Builder};
use uuid::Uuid;

/// Result of a repository sync operation.
#[derive(Debug, Clone)]
pub struct SyncResult {
    /// Path to the repository archive (compact mode) or folder (non-compact mode)
    pub path: PathBuf,
    /// Size in bytes
    pub size: u64,
    /// Latest commit hash
    pub commit_hash: String,
    /// Latest commit message (first line)
    pub commit_message: String,
    /// Whether the sync was skipped because repository was already up-to-date
    pub skipped: bool,
    /// Status message from GitSafe (e.g., "Repository synced successfully" or "Repository already up-to-date")
    pub status_message: String,
}

/// Service for managing Git repository synchronization and archiving.
///
/// The service supports two storage modes:
/// - **Compact mode**: Repositories are stored as compressed tarballs (.tar.gz).
///   On each sync, the archive is unpacked, updated, and re-archived.
/// - **Non-compact mode**: Repositories are stored as regular folders.
///   On each sync, changes are pulled incrementally without re-cloning.
///
/// Repository names are derived from URLs to prevent collisions:
/// `https://github.com/example/repo1` → `github_com-example-repo1`
#[derive(Clone)]
pub struct GitService {
    archive_dir: PathBuf,
    compact: bool,
}

impl GitService {
    /// Creates a new GitService instance.
    ///
    /// # Arguments
    ///
    /// * `archive_dir` - Directory path where repositories will be stored
    /// * `compact` - If `true`, repositories are stored as compressed tarballs.
    ///   If `false`, repositories are stored as folders.
    ///
    /// # Returns
    ///
    /// Returns `Ok(GitService)` if the archive directory is created successfully,
    /// or an `AppError` if directory creation fails.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use gitsafe::git::GitService;
    ///
    /// let service = GitService::new("./archives", true)?;
    /// # Ok::<(), Box<dyn std::error::Error>>(())
    /// ```
    pub fn new<P: AsRef<Path>>(archive_dir: P, compact: bool) -> Result<Self, AppError> {
        let archive_dir = archive_dir.as_ref().to_path_buf();
        fs::create_dir_all(&archive_dir)?;
        Ok(GitService {
            archive_dir,
            compact,
        })
    }

    /// Generates a repository ID from a Git URL (for use as identifier).
    ///
    /// The ID is constructed by:
    /// 1. Extracting the domain and replacing dots with underscores
    /// 2. Extracting path segments (user/org and repository name)
    /// 3. Joining all parts with dashes
    /// 4. Removing `.git` suffix if present
    ///
    /// # Arguments
    ///
    /// * `url` - The Git repository URL
    ///
    /// # Returns
    ///
    /// A string representation of the repository ID suitable for use as an identifier.
    ///
    /// # Examples
    ///
    /// ```
    /// use gitsafe::git::GitService;
    ///
    /// let id = GitService::repo_id_from_url("https://github.com/example/repo1");
    /// assert_eq!(id, "github_com-example-repo1");
    ///
    /// let id = GitService::repo_id_from_url("https://gitlab.com/user/org/my-repo.git");
    /// assert_eq!(id, "gitlab_com-user-org-my-repo");
    ///
    /// let id = GitService::repo_id_from_url("git@github.com:example/repo1.git");
    /// assert_eq!(id, "github_com-example-repo1");
    /// ```
    pub fn repo_id_from_url(url: &str) -> String {
        let mut parts = Vec::new();

        // Check for SSH URL format: git@host:path
        if let Some(at_pos) = url.find('@') {
            if let Some(colon_pos) = url[at_pos..].find(':') {
                let host = &url[at_pos + 1..at_pos + colon_pos];
                let domain = host.replace('.', "_");
                parts.push(domain);

                let path = &url[at_pos + colon_pos + 1..];
                let path_segments: Vec<&str> = path.split('/').collect();
                for segment in path_segments {
                    if !segment.is_empty() {
                        let clean_segment = segment.strip_suffix(".git").unwrap_or(segment);
                        parts.push(clean_segment.to_string());
                    }
                }
                return parts.join("-");
            }
        }

        // Parse URL (HTTP/HTTPS)
        if let Ok(parsed) = url::Url::parse(url) {
            // Extract domain (replace dots with underscores)
            if let Some(host) = parsed.host_str() {
                let domain = host.replace('.', "_");
                parts.push(domain);
            }

            // Extract path segments (user/org and repo name)
            let path_segments: Vec<&str> = parsed
                .path_segments()
                .map(|s| s.collect())
                .unwrap_or_default();

            for segment in path_segments {
                if !segment.is_empty() {
                    // Remove .git suffix if present
                    let clean_segment = segment.strip_suffix(".git").unwrap_or(segment);
                    parts.push(clean_segment.to_string());
                }
            }
        } else {
            // Fallback: try to extract manually
            if let Some(domain_start) = url.find("://") {
                let after_protocol = &url[domain_start + 3..];
                if let Some(path_start) = after_protocol.find('/') {
                    let domain = after_protocol[..path_start].replace('.', "_");
                    parts.push(domain);

                    let path = &after_protocol[path_start + 1..];
                    let path_segments: Vec<&str> = path.split('/').collect();
                    for segment in path_segments {
                        if !segment.is_empty() {
                            let clean_segment = segment.strip_suffix(".git").unwrap_or(segment);
                            parts.push(clean_segment.to_string());
                        }
                    }
                }
            }
        }

        parts.join("-")
    }

    /// Generates a repository storage path from a Git URL, preserving directory hierarchy.
    ///
    /// The path is constructed by:
    /// 1. Extracting the domain and replacing dots with underscores
    /// 2. Extracting path segments (user/org and repository name)
    /// 3. Joining all parts with forward slashes to preserve hierarchy
    /// 4. Removing `.git` suffix if present
    /// 5. If `compact` is true, appends `.tar.gz` extension for archive path
    ///
    /// # Arguments
    ///
    /// * `url` - The Git repository URL
    /// * `compact` - If true, returns path to archive file (with `.tar.gz` extension).
    ///   If false, returns path to repository directory.
    ///
    /// # Returns
    ///
    /// A string representation of the repository path with directory separators,
    /// suitable for use as a nested directory path for storage.
    /// - Compact mode: `github_com/example/repo1.tar.gz`
    /// - Non-compact mode: `github_com/example/repo1`
    ///
    /// # Examples
    ///
    /// ```
    /// use gitsafe::git::GitService;
    ///
    /// // Compact mode - returns archive path
    /// let path = GitService::repo_path_from_url("https://github.com/example/repo1", true);
    /// assert_eq!(path, "github_com/example/repo1.tar.gz");
    ///
    /// // Non-compact mode - returns directory path
    /// let path = GitService::repo_path_from_url("https://github.com/example/repo1", false);
    /// assert_eq!(path, "github_com/example/repo1");
    ///
    /// let path = GitService::repo_path_from_url("https://gitlab.com/user/org/my-repo.git", true);
    /// assert_eq!(path, "gitlab_com/user/org/my-repo.tar.gz");
    ///
    /// // SSH URL support
    /// let path = GitService::repo_path_from_url("git@github.com:example/repo1.git", true);
    /// assert_eq!(path, "github_com/example/repo1.tar.gz");
    ///
    /// let path = GitService::repo_path_from_url("git@github.com:example/repo1.git", false);
    /// assert_eq!(path, "github_com/example/repo1");
    /// ```
    pub fn repo_path_from_url(url: &str, compact: bool) -> String {
        let mut parts = Vec::new();

        // Check for SSH URL format: git@host:path
        if let Some(at_pos) = url.find('@') {
            if let Some(colon_pos) = url[at_pos..].find(':') {
                let host = &url[at_pos + 1..at_pos + colon_pos];
                let domain = host.replace('.', "_");
                parts.push(domain);

                let path = &url[at_pos + colon_pos + 1..];
                let path_segments: Vec<&str> = path.split('/').collect();
                for segment in path_segments {
                    if !segment.is_empty() {
                        let clean_segment = segment.strip_suffix(".git").unwrap_or(segment);
                        parts.push(clean_segment.to_string());
                    }
                }
                let base_path = parts.join("/");
                return if compact {
                    format!("{}.tar.gz", base_path)
                } else {
                    base_path
                };
            }
        }

        // Parse URL (HTTP/HTTPS)
        if let Ok(parsed) = url::Url::parse(url) {
            // Extract domain (replace dots with underscores)
            if let Some(host) = parsed.host_str() {
                let domain = host.replace('.', "_");
                parts.push(domain);
            }

            // Extract path segments (user/org and repo name)
            let path_segments: Vec<&str> = parsed
                .path_segments()
                .map(|s| s.collect())
                .unwrap_or_default();

            for segment in path_segments {
                if !segment.is_empty() {
                    // Remove .git suffix if present
                    let clean_segment = segment.strip_suffix(".git").unwrap_or(segment);
                    parts.push(clean_segment.to_string());
                }
            }
        } else {
            // Fallback: try to extract manually
            if let Some(domain_start) = url.find("://") {
                let after_protocol = &url[domain_start + 3..];
                if let Some(path_start) = after_protocol.find('/') {
                    let domain = after_protocol[..path_start].replace('.', "_");
                    parts.push(domain);

                    let path = &after_protocol[path_start + 1..];
                    let path_segments: Vec<&str> = path.split('/').collect();
                    for segment in path_segments {
                        if !segment.is_empty() {
                            let clean_segment = segment.strip_suffix(".git").unwrap_or(segment);
                            parts.push(clean_segment.to_string());
                        }
                    }
                }
            }
        }

        let base_path = parts.join("/");

        if compact {
            format!("{}.tar.gz", base_path)
        } else {
            base_path
        }
    }

    /// Synchronizes a Git repository, updating it with the latest changes from the remote.
    ///
    /// Before performing any expensive operations (unpacking, pulling), this method checks
    /// if the repository is already up-to-date by comparing the remote HEAD commit hash with
    /// the stored `last_sync_commit_hash`. If they match, the sync is skipped and only the
    /// timestamp is updated.
    ///
    /// The behavior depends on the `compact` mode:
    /// - **Compact mode**: Unpacks existing archive (if any), pulls/clones updates,
    ///   creates a new archive, and cleans up temporary files.
    /// - **Non-compact mode**: Clones the repository (if new) or pulls updates (if exists),
    ///   then calculates the cumulative folder size.
    ///
    /// # Arguments
    ///
    /// * `repo` - The repository configuration to sync
    /// * `credential` - Optional credential for authenticated access
    /// * `encryption_key` - Key used to decrypt SSH keys if they are encrypted
    ///
    /// # Returns
    ///
    /// Returns `SyncResult` containing:
    /// - Path to the archive file (compact mode) or repository folder (non-compact mode)
    /// - Size in bytes of the archive or folder
    /// - Latest commit hash
    /// - Latest commit message (first line)
    /// - Whether the sync was skipped (already up-to-date)
    ///
    /// # Errors
    ///
    /// Returns `AppError` if:
    /// - Fetching remote commit hash fails
    /// - Repository cloning fails
    /// - Pulling updates fails
    /// - Archive creation/unpacking fails
    /// - File system operations fail
    ///
    /// # Example
    ///
    /// ```no_run
    /// use gitsafe::git::GitService;
    /// use gitsafe::config::Repository;
    ///
    /// let service = GitService::new("./archives", true)?;
    /// let repo = Repository {
    ///     id: "test".to_string(),
    ///     url: "https://github.com/example/repo.git".to_string(),
    ///     credential_id: None,
    ///     enabled: true,
    ///     last_sync: None,
    ///     last_sync_commit_hash: None,
    ///     last_sync_message: None,
    ///     error: None,
    ///     size: None,
    ///     attempts_left: None,
    /// };
    /// let result = service.sync_repository(&repo, None, "encryption-key")?;
    /// # Ok::<(), Box<dyn std::error::Error>>(())
    /// ```
    pub fn sync_repository(
        &self,
        repo: &Repository,
        credential: Option<&Credential>,
        encryption_key: &str,
    ) -> Result<SyncResult, AppError> {
        info!("Syncing repository: {} ({})", repo.id, repo.url);

        // Check if repository is already up-to-date by comparing commit hashes
        if repo.last_sync_commit_hash.is_some() {
            match self.get_latest_commit_hash(&repo.url, credential, encryption_key) {
                Ok((remote_hash, remote_message)) => {
                    // If we have a stored hash and it matches, skip the sync
                    if let Some(ref stored_hash) = repo.last_sync_commit_hash {
                        if stored_hash == &remote_hash {
                            info!(
                                "Repository {} is already up-to-date (commit: {}), skipping sync",
                                repo.id, remote_hash
                            );

                            // Use repo_path_from_url for storage paths (with slashes)
                            let repo_path = Self::repo_path_from_url(&repo.url, self.compact);
                            let archive_path = self.archive_dir.join(&repo_path);

                            // Get existing size
                            let size = if archive_path.exists() {
                                fs::metadata(&archive_path).map(|m| m.len()).unwrap_or(0)
                            } else {
                                0
                            };

                            return Ok(SyncResult {
                                path: archive_path,
                                size,
                                commit_hash: remote_hash,
                                commit_message: remote_message,
                                skipped: true,
                                status_message: "Repository already up-to-date".to_string(),
                            });
                        }
                    }
                }
                Err(e) => {
                    // If we can't fetch the remote hash, log a warning but continue with sync
                    // This might happen if the repository is new or network issues occur
                    info!(
                        "Could not fetch remote commit hash for {}: {}. Proceeding with sync.",
                        repo.id, e
                    );
                }
            }
        }

        // Use repo_path_from_url for storage paths (with slashes)
        // Pass compact mode to get correct path (archive or directory)
        let repo_path = Self::repo_path_from_url(&repo.url, self.compact);

        if self.compact {
            self.sync_repository_compact(repo, &repo_path, credential, encryption_key)
        } else {
            self.sync_repository_non_compact(repo, &repo_path, credential, encryption_key)
        }
    }

    /// Creates RemoteCallbacks configured with authentication from a credential.
    ///
    /// Handles both SSH key and username/password authentication, with automatic
    /// decryption of encrypted credentials.
    ///
    /// # Arguments
    ///
    /// * `credential` - Optional credential for authenticated access
    /// * `encryption_key` - Key used to decrypt SSH keys and passwords if encrypted
    ///
    /// # Returns
    ///
    /// Returns `Ok(RemoteCallbacks)` configured with authentication, or `AppError` if
    /// credential decryption fails.
    #[allow(mismatched_lifetime_syntaxes)] // RemoteCallbacks doesn't have a lifetime parameter
    fn create_remote_callbacks(
        &self,
        credential: Option<&Credential>,
        encryption_key: &str,
    ) -> Result<RemoteCallbacks, AppError> {
        let mut callbacks = RemoteCallbacks::new();

        if let Some(cred) = credential {
            let username = cred.username.clone();
            // Decrypt password if present and encrypted, or use as-is for backward compatibility
            let password = cred
                .password
                .as_ref()
                .map(|p| encryption::decrypt_password(p, encryption_key))
                .unwrap_or_default();

            // Decrypt SSH key if encrypted
            let ssh_key_data: Option<String> = if let Some(ref key_data) = cred.ssh_key {
                // Check if it's plaintext SSH key content
                if key_data.starts_with("-----BEGIN") || key_data.contains('\n') {
                    Some(key_data.clone())
                } else {
                    // Likely encrypted - try to decrypt
                    match encryption::decrypt_ssh_key(key_data, encryption_key) {
                        Ok(decrypted) => Some(decrypted),
                        Err(_) => {
                            // If decryption fails, return error - SSH keys must be valid content
                            return Err(AppError::GitError(
                                "Invalid SSH key: decryption failed and key does not appear to be valid SSH key content".to_string()
                            ));
                        }
                    }
                }
            } else {
                None
            };

            callbacks.credentials(move |_url, username_from_url, allowed_types| {
                // Prefer SSH key if available and requested
                if allowed_types.contains(CredentialType::SSH_KEY) {
                    if let Some(ref key_data) = ssh_key_data {
                        // Use SSH key from memory
                        return Cred::ssh_key_from_memory(
                            username_from_url.unwrap_or(&username),
                            None,
                            key_data,
                            None,
                        );
                    } else {
                        return Err(git2::Error::from_str("Authentication failed: no SSH key provided for git repository. Have you chosen the correct credential or passed the correct repository URL?"))
                    }
                }

                // Fall back to username/password for HTTP/HTTPS if available
                if allowed_types.contains(CredentialType::USER_PASS_PLAINTEXT) {
                    if !password.is_empty() {
                        Cred::userpass_plaintext(&username, &password)
                    } else {
                        Err(git2::Error::from_str("Authentication failed: no password provided for HTTP/HTTPS git repository. Have you chosen the correct credential or passed the correct repository URL?"))
                    }
                } else {
                    Err(git2::Error::from_str("Authentication failed: no matching credentials available. Have you chosen the correct credential or passed the correct repository URL?"))
                }
            });
        }

        Ok(callbacks)
    }

    /// Gets the latest commit hash and message from a local repository.
    ///
    /// After pull_repository, the local branch is updated directly (via refs/heads/*:refs/heads/*).
    /// This function uses FETCH_HEAD first (which contains the commit that was fetched),
    /// then falls back to the current branch reference (which should be updated after pull),
    /// and finally HEAD as a last resort.
    ///
    /// # Arguments
    ///
    /// * `git_repo` - An open Git repository instance
    ///
    /// # Returns
    ///
    /// Returns `Ok((commit_hash, commit_message))` on success.
    fn get_local_commit_info(
        &self,
        git_repo: &GitRepository,
    ) -> Result<(String, String), AppError> {
        // Get the current branch name
        let head = git_repo
            .head()
            .map_err(|e| AppError::GitError(format!("Failed to get HEAD: {}", e)))?;
        let branch_name = head
            .name()
            .ok_or_else(|| AppError::GitError("Failed to get branch name".to_string()))?;

        info!("Current branch: {}", branch_name);

        // Strategy 1: Use FETCH_HEAD first (same as pull_repository uses)
        // This is the most reliable since pull_repository uses FETCH_HEAD to get the fetched commit
        // FETCH_HEAD now contains only the current branch's commit since we fetch only that branch
        let commit = match git_repo.find_reference("FETCH_HEAD") {
            Ok(fetch_head) => {
                info!("Using FETCH_HEAD (same as pull_repository)");
                // Use the exact same approach as pull_repository:
                // reference_to_annotated_commit then find_commit
                let fetch_commit = git_repo
                    .reference_to_annotated_commit(&fetch_head)
                    .map_err(|e| {
                        AppError::GitError(format!(
                            "Failed to get annotated commit from FETCH_HEAD: {}",
                            e
                        ))
                    })?;
                let commit_obj = git_repo.find_commit(fetch_commit.id()).map_err(|e| {
                    AppError::GitError(format!("Failed to find commit from FETCH_HEAD: {}", e))
                })?;
                info!("FETCH_HEAD points to commit: {}", commit_obj.id());
                commit_obj
            }
            Err(_) => {
                // Strategy 2: Use the branch reference (updated by fetch)
                info!(
                    "FETCH_HEAD not available, using branch reference: {}",
                    branch_name
                );
                match git_repo.find_reference(branch_name) {
                    Ok(branch_ref) => {
                        let branch_commit = branch_ref.peel_to_commit().map_err(|e| {
                            AppError::GitError(format!(
                                "Failed to peel branch {} to commit: {}",
                                branch_name, e
                            ))
                        })?;
                        info!(
                            "Branch {} points to commit: {}",
                            branch_name,
                            branch_commit.id()
                        );
                        branch_commit
                    }
                    Err(_) => {
                        // Strategy 3: Fall back to HEAD
                        info!("Branch reference not found, using HEAD");
                        let head_commit = head.peel_to_commit().map_err(|e| {
                            AppError::GitError(format!("Failed to peel HEAD to commit: {}", e))
                        })?;
                        info!("HEAD points to commit: {}", head_commit.id());
                        head_commit
                    }
                }
            }
        };

        let commit_hash = commit.id().to_string();
        let commit_message = commit
            .message()
            .unwrap_or("(no message)")
            .lines()
            .next()
            .unwrap_or("(no message)")
            .to_string();

        log::debug!("Retrieved commit: {} - {}", commit_hash, commit_message);
        Ok((commit_hash, commit_message))
    }

    /// Synchronizes a repository in compact mode (tarball storage).
    ///
    /// Process:
    /// 1. If an existing archive exists, unpack it to a temporary directory
    /// 2. Clone the repository (if new) or pull updates (if exists)
    /// 3. Create a new compressed tarball archive
    /// 4. Replace the old archive with the new one
    /// 5. Clean up temporary repository folder
    /// 6. Return the archive path, size, and commit information
    ///
    /// # Arguments
    ///
    /// * `repo` - The repository configuration
    /// * `repo_path_str` - The generated repository path (from URL, includes .tar.gz extension)
    /// * `credential` - Optional credential for authentication
    /// * `encryption_key` - Key for decrypting SSH keys
    ///
    /// # Returns
    ///
    /// `SyncResult` containing archive path, size, commit hash, and commit message
    fn sync_repository_compact(
        &self,
        repo: &Repository,
        repo_path_str: &str,
        credential: Option<&Credential>,
        encryption_key: &str,
    ) -> Result<SyncResult, AppError> {
        // repo_path_str already includes .tar.gz extension from repo_path_from_url
        let archive_path = self.archive_dir.join(repo_path_str);

        // Ensure parent directories exist
        if let Some(parent) = archive_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let temp_dir = tempfile::tempdir().map_err(AppError::IoError)?;
        let work_dir = temp_dir.path();
        // Extract just the repo name (last segment before .tar.gz) for the working directory
        let repo_path_without_ext = repo_path_str
            .strip_suffix(".tar.gz")
            .unwrap_or(repo_path_str);
        let repo_name_only = repo_path_without_ext
            .split('/')
            .next_back()
            .unwrap_or(repo_path_without_ext);
        let repo_path = work_dir.join(repo_name_only);

        // If archive exists, unpack it first
        if archive_path.exists() {
            info!("Unpacking existing archive for repository: {}", repo.id);
            self.unpack_archive(&archive_path, work_dir)?;
        }

        // Clone or pull the repository
        let git_repo = if repo_path.exists() && repo_path.join(".git").exists() {
            // Repository exists, pull updates
            info!("Pulling updates for repository: {}", repo.id);
            let git_repo = GitRepository::open(&repo_path)
                .map_err(|e| AppError::GitError(format!("Failed to open repository: {}", e)))?;
            self.pull_repository(&git_repo, credential, encryption_key)?;
            git_repo
        } else {
            // Clone new repository
            info!("Cloning repository: {}", repo.id);
            self.clone_repository(&repo.url, &repo_path, credential, encryption_key)?;
            GitRepository::open(&repo_path).map_err(|e| {
                AppError::GitError(format!("Failed to open repository after clone: {}", e))
            })?
        };

        // Get commit hash and message from the synced repository
        let (commit_hash, commit_message) = self.get_local_commit_info(&git_repo)?;

        // Create new archive (use repo_name_only for archive contents, but store at repo_name path)
        // Pass the final archive path so temp archive is created in the same directory
        let new_archive_path = self.create_archive(repo_name_only, &repo_path, &archive_path)?;

        // Calculate archive size
        let archive_size = fs::metadata(&new_archive_path)
            .map(|m| m.len())
            .unwrap_or(0);

        // Replace old archive with new one
        // Ensure parent directory exists before moving
        if let Some(parent) = archive_path.parent() {
            fs::create_dir_all(parent)?;
        }
        if archive_path.exists() {
            fs::remove_file(&archive_path)?;
        }
        fs::rename(&new_archive_path, &archive_path)?;

        // Clean up repo folder
        if repo_path.exists() {
            fs::remove_dir_all(&repo_path)?;
        }

        info!(
            "Created archive: {:?} ({} bytes), commit: {}",
            archive_path, archive_size, commit_hash
        );
        Ok(SyncResult {
            path: archive_path,
            size: archive_size,
            commit_hash,
            commit_message,
            skipped: false,
            status_message: "Repository synced successfully".to_string(),
        })
    }

    /// Synchronizes a repository in non-compact mode (folder storage).
    ///
    /// Process:
    /// 1. If repository folder exists, pull updates
    /// 2. If repository folder doesn't exist, clone the repository
    /// 3. Calculate cumulative size of the repository folder
    /// 4. Return the folder path, size, and commit information
    ///
    /// # Arguments
    ///
    /// * `repo` - The repository configuration
    /// * `repo_path_str` - The generated repository path (from URL, directory path without .tar.gz)
    /// * `credential` - Optional credential for authentication
    /// * `encryption_key` - Key for decrypting SSH keys
    ///
    /// # Returns
    ///
    /// `SyncResult` containing folder path, size, commit hash, and commit message
    fn sync_repository_non_compact(
        &self,
        repo: &Repository,
        repo_path_str: &str,
        credential: Option<&Credential>,
        encryption_key: &str,
    ) -> Result<SyncResult, AppError> {
        // Create nested directory structure for repository
        let repo_path = self.archive_dir.join(repo_path_str);

        // Ensure parent directories exist
        if let Some(parent) = repo_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Clone or pull the repository
        let git_repo = if repo_path.exists() && repo_path.join(".git").exists() {
            // Repository exists, pull updates
            info!("Pulling updates for repository: {}", repo.id);
            let git_repo = GitRepository::open(&repo_path)
                .map_err(|e| AppError::GitError(format!("Failed to open repository: {}", e)))?;
            self.pull_repository(&git_repo, credential, encryption_key)?;
            git_repo
        } else {
            // Clone new repository
            info!("Cloning repository: {}", repo.id);
            self.clone_repository(&repo.url, &repo_path, credential, encryption_key)?;
            GitRepository::open(&repo_path).map_err(|e| {
                AppError::GitError(format!("Failed to open repository after clone: {}", e))
            })?
        };

        // Get commit hash and message from the synced repository
        let (commit_hash, commit_message) = self.get_local_commit_info(&git_repo)?;

        // Calculate cumulative folder size
        let folder_size = self.calculate_folder_size(&repo_path)?;

        info!(
            "Synced repository to folder: {:?} ({} bytes), commit: {}",
            repo_path, folder_size, commit_hash
        );
        Ok(SyncResult {
            path: repo_path,
            size: folder_size,
            commit_hash,
            commit_message,
            skipped: false,
            status_message: "Repository synced successfully".to_string(),
        })
    }

    /// Gets the latest commit hash and message from a remote repository without cloning.
    ///
    /// This method creates a temporary bare repository, connects to the remote,
    /// and fetches the HEAD reference to get the latest commit information.
    ///
    /// # Arguments
    ///
    /// * `url` - The Git repository URL
    /// * `credential` - Optional credential for authenticated access
    /// * `encryption_key` - Key used to decrypt SSH keys if encrypted
    ///
    /// # Returns
    ///
    /// Returns `Ok((commit_hash, commit_message))` on success, or `AppError` if fetching fails.
    ///
    /// # Errors
    ///
    /// Returns `AppError::GitError` if:
    /// - The repository URL is invalid
    /// - Authentication fails
    /// - Network connection fails
    /// - Remote HEAD reference cannot be found
    fn get_latest_commit_hash(
        &self,
        url: &str,
        credential: Option<&Credential>,
        encryption_key: &str,
    ) -> Result<(String, String), AppError> {
        log::debug!("Getting latest commit hash for repository: {}", url);

        // Create a temporary bare repository
        let temp_dir = tempfile::tempdir().map_err(AppError::IoError)?;
        let repo = GitRepository::init_bare(temp_dir.path())
            .map_err(|e| AppError::GitError(format!("Failed to init bare repository: {}", e)))?;

        // Create an anonymous remote
        let mut remote = repo
            .remote_anonymous(url)
            .map_err(|e| AppError::GitError(format!("Failed to create remote: {}", e)))?;

        // Set up callbacks for authentication
        let callbacks = self.create_remote_callbacks(credential, encryption_key)?;

        // Set up fetch options with callbacks
        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        // For SSH remotes, we need to establish connection first
        // Fetch with empty refspec list to connect and authenticate
        remote
            .fetch(&[] as &[&str], Some(&mut fetch_options), None)
            .map_err(|e| AppError::GitError(format!("Failed to connect to remote: {}", e)))?;

        // Now list remote references to find HEAD or default branch
        // This lists references without fetching objects, which is more efficient
        let refs = remote
            .list()
            .map_err(|e| AppError::GitError(format!("Failed to list remote references: {}", e)))?;

        // Try to find HEAD reference or default branch
        let mut commit_oid = None;
        let mut default_branch = None;

        // First, try to find HEAD symref which points to the default branch
        for ref_entry in refs.iter() {
            let ref_name = ref_entry.name();
            if ref_name == "HEAD" {
                // HEAD points to a branch, get the branch name
                if let Some(symref_target) = ref_entry.symref_target() {
                    default_branch = Some(symref_target.to_string());
                }
            }
        }

        // If we found a default branch from HEAD symref, get its OID
        if let Some(ref branch) = default_branch {
            for ref_entry in refs.iter() {
                if ref_entry.name() == branch {
                    commit_oid = Some(ref_entry.oid());
                    break;
                }
            }
        } else {
            info!("No HEAD symref found, trying to find default branch");
        }

        // If we still don't have a commit, try common default branch names
        if commit_oid.is_none() {
            for ref_entry in refs.iter() {
                let ref_name = ref_entry.name();
                if ref_name == "refs/heads/main" || ref_name == "refs/heads/master" {
                    commit_oid = Some(ref_entry.oid());
                    default_branch = Some(ref_name.to_string());
                    break;
                }
            }
        }

        // Fallback: use the first branch reference
        if commit_oid.is_none() {
            for ref_entry in refs.iter() {
                let ref_name = ref_entry.name();
                if ref_name.starts_with("refs/heads/") {
                    commit_oid = Some(ref_entry.oid());
                    default_branch = Some(ref_name.to_string());
                    break;
                }
            }
        }

        let commit_oid = commit_oid.ok_or_else(|| {
            AppError::GitError("Could not find any branch reference on remote. The repository may be empty or inaccessible.".to_string())
        })?;

        // Now fetch the commit to get its message
        // We need to fetch the commit object to get the message
        // Recreate callbacks and fetch options for the second fetch
        let callbacks2 = self.create_remote_callbacks(credential, encryption_key)?;
        let mut fetch_options2 = FetchOptions::new();
        fetch_options2.remote_callbacks(callbacks2);

        let branch_ref = default_branch.as_deref().unwrap_or("HEAD");
        let refspec = format!("{}:refs/remotes/origin/{}", branch_ref, branch_ref);
        remote
            .fetch(&[&refspec], Some(&mut fetch_options2), None)
            .map_err(|e| AppError::GitError(format!("Failed to fetch commit: {}", e)))?;

        // Get commit message from the fetched commit
        let commit_obj = repo
            .find_commit(commit_oid)
            .map_err(|e| AppError::GitError(format!("Failed to find commit: {}", e)))?;

        let commit_message = commit_obj
            .message()
            .unwrap_or("(no message)")
            .lines()
            .next()
            .unwrap_or("(no message)")
            .to_string();

        log::debug!(
            "Latest commit hash: {} and message: {}",
            commit_oid,
            commit_message
        );
        Ok((commit_oid.to_string(), commit_message))
    }

    /// Clones a Git repository from a remote URL.
    ///
    /// Supports authentication via:
    /// - Username/password (HTTP/HTTPS)
    /// - SSH key (from memory or file path)
    /// - Encrypted SSH keys (automatically decrypted)
    ///
    /// # Arguments
    ///
    /// * `url` - The Git repository URL to clone
    /// * `repo_path` - Local path where the repository should be cloned
    /// * `credential` - Optional credential for authenticated access
    /// * `encryption_key` - Key used to decrypt SSH keys if encrypted
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` on success, or `AppError` if cloning fails.
    ///
    /// # Errors
    ///
    /// Returns `AppError::GitError` if:
    /// - The repository URL is invalid
    /// - Authentication fails
    /// - Network connection fails
    /// - File system operations fail
    fn clone_repository(
        &self,
        url: &str,
        repo_path: &Path,
        credential: Option<&Credential>,
        encryption_key: &str,
    ) -> Result<(), AppError> {
        // Set up callbacks for authentication
        let callbacks = self.create_remote_callbacks(credential, encryption_key)?;

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        let mut builder = RepoBuilder::new();
        builder.fetch_options(fetch_options);

        // Clone the repository
        builder
            .clone(url, repo_path)
            .map_err(|e| AppError::GitError(format!("Failed to clone repository: {}", e)))?;

        Ok(())
    }

    /// Pulls the latest changes from the remote repository and merges them locally.
    ///
    /// This function:
    /// 1. Fetches updates from the remote "origin"
    /// 2. Analyzes if a merge is needed
    /// 3. Performs fast-forward merge if possible
    /// 4. Creates a merge commit if fast-forward is not possible
    /// 5. Handles merge conflicts (returns error if conflicts exist)
    ///
    /// # Arguments
    ///
    /// * `git_repo` - An open Git repository instance
    /// * `credential` - Optional credential for authenticated access
    /// * `encryption_key` - Key used to decrypt SSH keys if encrypted
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` on success, or `AppError` if:
    /// - Fetching fails
    /// - Merge conflicts are detected
    /// - Merge operations fail
    ///
    /// # Errors
    ///
    /// Returns `AppError::GitError` if:
    /// - Remote "origin" is not found
    /// - Authentication fails
    /// - Merge conflicts are detected
    /// - Git operations fail
    fn pull_repository(
        &self,
        git_repo: &GitRepository,
        credential: Option<&Credential>,
        encryption_key: &str,
    ) -> Result<(), AppError> {
        // Find the remote
        let mut remote = git_repo
            .find_remote("origin")
            .map_err(|e| AppError::GitError(format!("Failed to find remote: {}", e)))?;

        // Set up callbacks for authentication
        let callbacks = self.create_remote_callbacks(credential, encryption_key)?;

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        // Get the current branch name before fetching
        let head = git_repo
            .head()
            .map_err(|e| AppError::GitError(format!("Failed to get HEAD: {}", e)))?;
        let branch_name = head
            .name()
            .ok_or_else(|| AppError::GitError("Failed to get branch name".to_string()))?;

        // Extract branch name from refs/heads/... format
        let branch_short_name = branch_name
            .strip_prefix("refs/heads/")
            .unwrap_or(branch_name);

        // Fetch only the current branch to ensure FETCH_HEAD contains the right commit
        let refspec = format!(
            "refs/heads/{}:refs/heads/{}",
            branch_short_name, branch_short_name
        );
        info!("Fetching branch: {}", refspec);
        remote
            .fetch(&[&refspec], Some(&mut fetch_options), None)
            .map_err(|e| AppError::GitError(format!("Failed to fetch updates: {}", e)))?;

        // Merge fetched changes
        let fetch_head = git_repo
            .find_reference("FETCH_HEAD")
            .map_err(|e| AppError::GitError(format!("Failed to find FETCH_HEAD: {}", e)))?;
        let fetch_commit = git_repo
            .reference_to_annotated_commit(&fetch_head)
            .map_err(|e| AppError::GitError(format!("Failed to get commit: {}", e)))?;

        let analysis = git_repo
            .merge_analysis(&[&fetch_commit])
            .map_err(|e| AppError::GitError(format!("Failed to analyze merge: {}", e)))?;

        if analysis.0.is_up_to_date() {
            info!("Repository is already up to date");
        } else {
            // Always reset to remote state, discarding any local changes
            // This ensures we always match the remote repository state and never create merge commits
            let head = git_repo
                .head()
                .map_err(|e| AppError::GitError(format!("Failed to get HEAD: {}", e)))?;
            let branch_name = head
                .name()
                .ok_or_else(|| AppError::GitError("Failed to get branch name".to_string()))?;

            // Get the commit object from the annotated commit
            let fetch_commit_obj = git_repo.find_object(fetch_commit.id(), None).map_err(|e| {
                AppError::GitError(format!("Failed to find fetch commit object: {}", e))
            })?;

            // Reset HEAD to the fetched commit (remote state), discarding local changes
            git_repo
                .reset(&fetch_commit_obj, git2::ResetType::Hard, None)
                .map_err(|e| {
                    AppError::GitError(format!("Failed to reset to remote state: {}", e))
                })?;

            // Update the branch reference to point to the remote commit
            let mut reference = git_repo.find_reference(branch_name).map_err(|e| {
                AppError::GitError(format!("Failed to find branch {}: {}", branch_name, e))
            })?;
            reference
                .set_target(fetch_commit.id(), "Reset to remote state")
                .map_err(|e| AppError::GitError(format!("Failed to update reference: {}", e)))?;
            git_repo
                .set_head(branch_name)
                .map_err(|e| AppError::GitError(format!("Failed to set HEAD: {}", e)))?;
            git_repo
                .checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
                .map_err(|e| AppError::GitError(format!("Failed to checkout: {}", e)))?;
        }

        Ok(())
    }

    /// Unpacks a compressed tar.gz archive to a destination directory.
    ///
    /// # Arguments
    ///
    /// * `archive_path` - Path to the .tar.gz archive file
    /// * `dest_dir` - Directory where the archive contents should be extracted
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` on success, or `AppError` if unpacking fails.
    ///
    /// # Errors
    ///
    /// Returns `AppError` if:
    /// - The archive file cannot be opened
    /// - The archive is corrupted
    /// - File system operations fail
    fn unpack_archive(&self, archive_path: &Path, dest_dir: &Path) -> Result<(), AppError> {
        let file = File::open(archive_path)?;
        let decoder = GzDecoder::new(file);
        let mut archive = Archive::new(decoder);
        archive.unpack(dest_dir).map_err(AppError::IoError)?;
        Ok(())
    }

    /// Recursively calculates the total size of a directory and all its contents.
    ///
    /// This function traverses the directory tree and sums up the size of all files,
    /// including files in subdirectories.
    ///
    /// # Arguments
    ///
    /// * `folder_path` - Path to the directory to calculate size for
    ///
    /// # Returns
    ///
    /// Returns the total size in bytes, or `AppError` if calculation fails.
    ///
    /// # Errors
    ///
    /// Returns `AppError` if:
    /// - The path doesn't exist or is not a directory
    /// - Directory reading fails
    /// - File metadata cannot be accessed
    #[allow(clippy::only_used_in_recursion)]
    fn calculate_folder_size(&self, folder_path: &Path) -> Result<u64, AppError> {
        let mut total_size = 0u64;

        if folder_path.is_dir() {
            for entry in fs::read_dir(folder_path)? {
                let entry = entry?;
                let path = entry.path();

                if path.is_dir() {
                    total_size += self.calculate_folder_size(&path)?;
                } else {
                    total_size += fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                }
            }
        }

        Ok(total_size)
    }

    /// Creates a compressed tar.gz archive from a repository directory.
    ///
    /// The archive is created with a temporary name (`.tmp.tar.gz` suffix) to allow
    /// atomic replacement of existing archives.
    ///
    /// # Arguments
    ///
    /// * `repo_name` - Name of the repository (used as the archive entry name, should be just the repo name, not the full path)
    /// * `repo_path` - Path to the repository directory to archive
    /// * `final_archive_path` - Path where the final archive will be stored (used to determine temp archive location)
    ///
    /// # Returns
    ///
    /// Returns the path to the created temporary archive file.
    ///
    /// # Errors
    ///
    /// Returns `AppError` if:
    /// - Archive file cannot be created
    /// - Directory reading fails
    /// - Compression fails
    fn create_archive(
        &self,
        repo_name: &str,
        repo_path: &Path,
        final_archive_path: &Path,
    ) -> Result<PathBuf, AppError> {
        // Create temp archive in the same directory as the final archive
        let temp_archive_name = format!("{}.tmp.tar.gz", Uuid::new_v4());
        let temp_archive_path = final_archive_path
            .parent()
            .unwrap_or(&self.archive_dir)
            .join(&temp_archive_name);

        // Ensure parent directory exists
        if let Some(parent) = temp_archive_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let tar_gz = File::create(&temp_archive_path)?;
        let enc = GzEncoder::new(tar_gz, Compression::default());
        let mut tar = Builder::new(enc);

        tar.append_dir_all(repo_name, repo_path)
            .map_err(AppError::IoError)?;

        tar.finish().map_err(AppError::IoError)?;

        Ok(temp_archive_path)
    }

    /// Lists all archive files (.tar.gz) in the archive directory.
    ///
    /// Only files ending with `.tar.gz` are included. The list is sorted
    /// with the most recent files first (reverse chronological order).
    ///
    /// # Returns
    ///
    /// Returns a vector of archive filenames, or `AppError` if listing fails.
    ///
    /// # Errors
    ///
    /// Returns `AppError` if:
    /// - The archive directory cannot be read
    /// - File system operations fail
    ///
    /// # Example
    ///
    /// ```no_run
    /// use gitsafe::git::GitService;
    ///
    /// let service = GitService::new("./archives", true)?;
    /// let archives = service.list_archives()?;
    /// for archive in archives {
    ///     println!("Found archive: {}", archive);
    /// }
    /// # Ok::<(), Box<dyn std::error::Error>>(())
    /// ```
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
