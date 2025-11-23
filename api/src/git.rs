use crate::config::{Credential, Repository};
use crate::encryption;
use crate::error::AppError;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use git2::{build::RepoBuilder, Cred, FetchOptions, RemoteCallbacks, Repository as GitRepository};
use log::info;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use tar::{Archive, Builder};
use uuid::Uuid;

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
    /// ```
    pub fn repo_id_from_url(url: &str) -> String {
        let mut parts = Vec::new();

        // Parse URL
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
    /// ```
    pub fn repo_path_from_url(url: &str, compact: bool) -> String {
        let mut parts = Vec::new();

        // Parse URL
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
    /// Returns a tuple containing:
    /// - `PathBuf`: Path to the archive file (compact mode) or repository folder (non-compact mode)
    /// - `u64`: Size in bytes of the archive or folder
    ///
    /// # Errors
    ///
    /// Returns `AppError` if:
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
    ///     error: None,
    ///     size: None,
    ///     attempts_left: None,
    /// };
    /// let (path, size) = service.sync_repository(&repo, None, "encryption-key")?;
    /// # Ok::<(), Box<dyn std::error::Error>>(())
    /// ```
    pub fn sync_repository(
        &self,
        repo: &Repository,
        credential: Option<&Credential>,
        encryption_key: &str,
    ) -> Result<(PathBuf, u64), AppError> {
        info!("Syncing repository: {} ({})", repo.id, repo.url);

        // Use repo_path_from_url for storage paths (with slashes)
        // Pass compact mode to get correct path (archive or directory)
        let repo_path = Self::repo_path_from_url(&repo.url, self.compact);

        if self.compact {
            self.sync_repository_compact(repo, &repo_path, credential, encryption_key)
        } else {
            self.sync_repository_non_compact(repo, &repo_path, credential, encryption_key)
        }
    }

    /// Synchronizes a repository in compact mode (tarball storage).
    ///
    /// Process:
    /// 1. If an existing archive exists, unpack it to a temporary directory
    /// 2. Clone the repository (if new) or pull updates (if exists)
    /// 3. Create a new compressed tarball archive
    /// 4. Replace the old archive with the new one
    /// 5. Clean up temporary repository folder
    /// 6. Return the archive path and size
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
    /// Tuple of (archive_path, archive_size_in_bytes)
    fn sync_repository_compact(
        &self,
        repo: &Repository,
        repo_path_str: &str,
        credential: Option<&Credential>,
        encryption_key: &str,
    ) -> Result<(PathBuf, u64), AppError> {
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
        if repo_path.exists() && repo_path.join(".git").exists() {
            // Repository exists, pull updates
            info!("Pulling updates for repository: {}", repo.id);
            let git_repo = GitRepository::open(&repo_path)
                .map_err(|e| AppError::GitError(format!("Failed to open repository: {}", e)))?;
            self.pull_repository(&git_repo, credential, encryption_key)?;
        } else {
            // Clone new repository
            info!("Cloning repository: {}", repo.id);
            self.clone_repository(&repo.url, &repo_path, credential, encryption_key)?;
        }

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
            "Created archive: {:?} ({} bytes)",
            archive_path, archive_size
        );
        Ok((archive_path, archive_size))
    }

    /// Synchronizes a repository in non-compact mode (folder storage).
    ///
    /// Process:
    /// 1. If repository folder exists, pull updates
    /// 2. If repository folder doesn't exist, clone the repository
    /// 3. Calculate cumulative size of the repository folder
    /// 4. Return the folder path and size
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
    /// Tuple of (folder_path, cumulative_size_in_bytes)
    fn sync_repository_non_compact(
        &self,
        repo: &Repository,
        repo_path_str: &str,
        credential: Option<&Credential>,
        encryption_key: &str,
    ) -> Result<(PathBuf, u64), AppError> {
        // Create nested directory structure for repository
        let repo_path = self.archive_dir.join(repo_path_str);

        // Ensure parent directories exist
        if let Some(parent) = repo_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Clone or pull the repository
        if repo_path.exists() && repo_path.join(".git").exists() {
            // Repository exists, pull updates
            info!("Pulling updates for repository: {}", repo.id);
            let git_repo = GitRepository::open(&repo_path)
                .map_err(|e| AppError::GitError(format!("Failed to open repository: {}", e)))?;
            self.pull_repository(&git_repo, credential, encryption_key)?;
        } else {
            // Clone new repository
            info!("Cloning repository: {}", repo.id);
            self.clone_repository(&repo.url, &repo_path, credential, encryption_key)?;
        }

        // Calculate cumulative folder size
        let folder_size = self.calculate_folder_size(&repo_path)?;

        info!(
            "Synced repository to folder: {:?} ({} bytes)",
            repo_path, folder_size
        );
        Ok((repo_path, folder_size))
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

            callbacks.credentials(move |_url, username_from_url, _allowed_types| {
                if let Some(ref key_data) = ssh_key_data {
                    // Use SSH key from memory (always key content, never file path)
                    Cred::ssh_key_from_memory(
                        username_from_url.unwrap_or(&username),
                        None,
                        key_data,
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

            callbacks.credentials(move |_url, username_from_url, _allowed_types| {
                if let Some(ref key_data) = ssh_key_data {
                    // Use SSH key from memory (always key content, never file path)
                    Cred::ssh_key_from_memory(
                        username_from_url.unwrap_or(&username),
                        None,
                        key_data,
                        None,
                    )
                } else {
                    Cred::userpass_plaintext(&username, &password)
                }
            });
        }

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        // Fetch updates
        remote
            .fetch(
                &["refs/heads/*:refs/heads/*"],
                Some(&mut fetch_options),
                None,
            )
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
        } else if analysis.0.is_fast_forward() {
            // Fast-forward merge
            let head = git_repo
                .head()
                .map_err(|e| AppError::GitError(format!("Failed to get HEAD: {}", e)))?;
            let branch_name = head
                .name()
                .ok_or_else(|| AppError::GitError("Failed to get branch name".to_string()))?;

            let mut reference = git_repo.find_reference(branch_name).map_err(|e| {
                AppError::GitError(format!("Failed to find branch {}: {}", branch_name, e))
            })?;
            reference
                .set_target(fetch_commit.id(), "Fast-forward merge")
                .map_err(|e| AppError::GitError(format!("Failed to update reference: {}", e)))?;
            git_repo
                .set_head(branch_name)
                .map_err(|e| AppError::GitError(format!("Failed to set HEAD: {}", e)))?;
            git_repo
                .checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
                .map_err(|e| AppError::GitError(format!("Failed to checkout: {}", e)))?;
        } else {
            // Need merge commit
            let head_commit = git_repo
                .head()
                .and_then(|h| h.peel_to_commit())
                .map_err(|e| AppError::GitError(format!("Failed to get HEAD commit: {}", e)))?;

            let fetch_commit_obj = git_repo.find_object(fetch_commit.id(), None).map_err(|e| {
                AppError::GitError(format!("Failed to find fetch commit object: {}", e))
            })?;
            let fetch_commit_commit = fetch_commit_obj
                .peel_to_commit()
                .map_err(|e| AppError::GitError(format!("Failed to get fetch commit: {}", e)))?;

            let mut index = git_repo
                .merge_commits(&head_commit, &fetch_commit_commit, None)
                .map_err(|e| AppError::GitError(format!("Failed to merge: {}", e)))?;

            if index.has_conflicts() {
                return Err(AppError::GitError("Merge conflicts detected".to_string()));
            }

            let tree_id = index
                .write_tree_to(git_repo)
                .map_err(|e| AppError::GitError(format!("Failed to write tree: {}", e)))?;
            let tree = git_repo
                .find_tree(tree_id)
                .map_err(|e| AppError::GitError(format!("Failed to find tree: {}", e)))?;

            let signature = git_repo
                .signature()
                .map_err(|e| AppError::GitError(format!("Failed to get signature: {}", e)))?;

            git_repo
                .commit(
                    Some("HEAD"),
                    &signature,
                    &signature,
                    "Merge updates",
                    &tree,
                    &[&head_commit, &fetch_commit_commit],
                )
                .map_err(|e| AppError::GitError(format!("Failed to create merge commit: {}", e)))?;
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
