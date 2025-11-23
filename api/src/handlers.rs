use crate::auth::AuthService;
use crate::config::{Config, Credential, Repository};
use crate::encryption;
use crate::error::AppError;
use crate::git::GitService;
use crate::middleware::AuthenticatedUser;
use crate::webhooks;
use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Application state shared across all request handlers.
///
/// Contains the configuration, authentication service, and Git service
/// instances needed by handlers.
pub struct AppState {
    /// Shared configuration (read-write lock for concurrent access)
    pub config: Arc<RwLock<Config>>,
    /// Path to the configuration file
    pub config_path: String,
    /// Authentication service for JWT operations
    pub auth_service: AuthService,
    /// Git service for repository operations
    pub git_service: GitService,
}

// Request/Response types

/// Login request payload.
#[derive(Debug, Deserialize, Serialize)]
pub struct LoginRequest {
    /// Username for authentication
    pub username: String,
    /// Password for authentication
    pub password: String,
}

/// Login response containing JWT token.
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    /// JWT token for authenticated requests
    pub token: String,
}

/// Request payload for adding a new repository.
#[derive(Debug, Deserialize)]
pub struct AddRepositoryRequest {
    /// Git repository URL
    pub url: String,
    /// Optional credential ID for authenticated access
    pub credential_id: Option<String>,
}

/// Request payload for updating repository settings.
#[derive(Debug, Deserialize)]
pub struct UpdateRepositoryRequest {
    /// Whether the repository is enabled for syncing
    pub enabled: Option<bool>,
    /// Optional credential ID for authenticated access
    pub credential_id: Option<String>,
}

/// Repository information response.
#[derive(Debug, Serialize)]
pub struct RepositoryResponse {
    pub id: String,
    pub url: String,
    pub credential_id: Option<String>,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sync: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

/// Request payload for adding a new credential.
#[derive(Debug, Deserialize)]
pub struct AddCredentialRequest {
    /// Username for Git authentication
    pub username: String,
    /// Password for Git authentication (can be empty if using SSH key)
    pub password: String,
    /// SSH private key content or file path (can be empty if using password)
    pub ssh_key: Option<String>,
}

/// Credential information response (without sensitive data).
#[derive(Debug, Serialize)]
pub struct CredentialResponse {
    /// Credential ID
    pub id: String,
    /// Username
    pub username: String,
}

/// Request payload for manually syncing a repository.
#[derive(Debug, Deserialize)]
pub struct SyncRequest {
    /// ID of the repository to sync
    pub repository_id: String,
}

/// Extracts the authenticated username from request extensions.
///
/// This helper function retrieves the username that was set by the AuthMiddleware
/// after successful token verification.
///
/// # Arguments
///
/// * `req` - HTTP request containing the authenticated user extension
///
/// # Returns
///
/// Returns the username string, or an error if the user is not authenticated.
pub fn get_authenticated_user(req: &HttpRequest) -> Result<String, AppError> {
    req.extensions()
        .get::<AuthenticatedUser>()
        .map(|user| user.0.clone())
        .ok_or_else(|| AppError::AuthError("User not authenticated".to_string()))
}

// Handlers
pub async fn login(
    data: web::Json<LoginRequest>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let config = state.config.read().await;
    let token = state
        .auth_service
        .authenticate(&data.username, &data.password, &config.users)?;

    Ok(HttpResponse::Ok().json(LoginResponse { token }))
}

/// Query parameters for searching/filtering repositories.
#[derive(Debug, Deserialize)]
pub struct SearchRepositoriesQuery {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub has_error: Option<bool>,
}

pub async fn list_repositories(
    query: web::Query<SearchRepositoriesQuery>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let config = state.config.read().await;
    let mut repositories: Vec<RepositoryResponse> = config
        .repositories
        .iter()
        .map(|r| RepositoryResponse {
            id: r.id.clone(),
            url: r.url.clone(),
            credential_id: r.credential_id.clone(),
            enabled: r.enabled,
            last_sync: r.last_sync,
            error: r.error.clone(),
            size: r.size,
        })
        .collect();

    // Apply filters
    if let Some(name_filter) = &query.name {
        if !name_filter.is_empty() {
            repositories.retain(|r| r.id.contains(name_filter) || r.url.contains(name_filter));
        }
    }

    if let Some(url_filter) = &query.url {
        if !url_filter.is_empty() {
            repositories.retain(|r| r.url.contains(url_filter));
        }
    }

    if let Some(has_error_filter) = query.has_error {
        repositories.retain(|r| {
            if has_error_filter {
                r.error.is_some()
            } else {
                r.error.is_none()
            }
        });
    }

    Ok(HttpResponse::Ok().json(repositories))
}

pub async fn add_repository(
    data: web::Json<AddRepositoryRequest>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let mut config = state.config.write().await;

    let repository = Repository {
        id: Uuid::new_v4().to_string(),
        url: data.url.clone(),
        credential_id: data.credential_id.clone(),
        enabled: true,
        last_sync: None,
        error: None,
        size: None,
    };

    let response = RepositoryResponse {
        id: repository.id.clone(),
        url: repository.url.clone(),
        credential_id: repository.credential_id.clone(),
        enabled: repository.enabled,
        last_sync: repository.last_sync,
        error: repository.error.clone(),
        size: repository.size,
    };

    config.repositories.push(repository);
    config
        .save(&state.config_path)
        .map_err(|e| AppError::ConfigError(e.to_string()))?;

    Ok(HttpResponse::Created().json(response))
}

pub async fn update_repository(
    path: web::Path<String>,
    data: web::Json<UpdateRepositoryRequest>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let repo_id = path.into_inner();
    let mut config = state.config.write().await;

    let repository = config
        .repositories
        .iter_mut()
        .find(|r| r.id == repo_id)
        .ok_or_else(|| AppError::NotFound(format!("Repository {} not found", repo_id)))?;

    // Update enabled status if provided
    if let Some(enabled) = data.enabled {
        repository.enabled = enabled;
    }

    // Update credential_id if provided
    // The frontend sends: string (with value), empty string, or null
    // Empty string or null both mean "no credential"
    if let Some(ref credential_id) = data.credential_id {
        if credential_id.trim().is_empty() {
            repository.credential_id = None;
        } else {
            repository.credential_id = Some(credential_id.trim().to_string());
        }
    }

    let response = RepositoryResponse {
        id: repository.id.clone(),
        url: repository.url.clone(),
        credential_id: repository.credential_id.clone(),
        enabled: repository.enabled,
        last_sync: repository.last_sync,
        error: repository.error.clone(),
        size: repository.size,
    };

    config
        .save(&state.config_path)
        .map_err(|e| AppError::ConfigError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(response))
}

pub async fn delete_repository(
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let repo_id = path.into_inner();
    let mut config = state.config.write().await;

    let initial_len = config.repositories.len();
    config.repositories.retain(|r| r.id != repo_id);

    if config.repositories.len() == initial_len {
        return Err(AppError::NotFound(format!(
            "Repository {} not found",
            repo_id
        )));
    }

    config
        .save(&state.config_path)
        .map_err(|e| AppError::ConfigError(e.to_string()))?;

    Ok(HttpResponse::NoContent().finish())
}

pub async fn sync_repository(
    data: web::Json<SyncRequest>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    // Clone necessary data before spawning blocking task
    let repository_id = data.repository_id.clone();
    let git_service = state.git_service.clone();
    let config_arc = Arc::clone(&state.config);
    let config_path = state.config_path.clone();

    // Read config to get repository and credential info
    let (repository, repository_for_sync, credential, encryption_key, webhooks) = {
        let config = state.config.read().await;
        let repository = config
            .repositories
            .iter()
            .find(|r| r.id == repository_id)
            .ok_or_else(|| AppError::NotFound("Repository not found".to_string()))?
            .clone();

        if !repository.enabled {
            return Err(AppError::BadRequest("Repository is disabled".to_string()));
        }

        let repository_for_sync = repository.clone(); // Clone for blocking task
        let credential = repository
            .credential_id
            .as_ref()
            .and_then(|id| config.credentials.get(id).cloned());
        let encryption_key = config.server.encryption_key.clone();
        let webhooks = config.server.error_webhooks.clone();
        (
            repository,
            repository_for_sync,
            credential,
            encryption_key,
            webhooks,
        )
    }; // Release lock before blocking operation

    // Run the blocking sync operation in a blocking thread pool
    let sync_result = tokio::task::spawn_blocking(move || {
        git_service.sync_repository(&repository_for_sync, credential.as_ref(), &encryption_key)
    })
    .await
    .map_err(|e| AppError::InternalError(format!("Task join error: {}", e)))?;

    // Handle sync errors and notify webhooks
    let (archive_path, archive_size) = match sync_result {
        Ok(result) => result,
        Err(e) => {
            // Notify webhooks about the error
            webhooks::notify_error_webhooks(
                &webhooks,
                &repository,
                "sync",
                repository.credential_id.as_ref(),
                &e.to_string(),
            )
            .await;
            return Err(e);
        }
    };

    // Update repository size and last_sync
    let mut config = config_arc.write().await;
    if let Some(repo) = config
        .repositories
        .iter_mut()
        .find(|r| r.id == repository_id)
    {
        repo.size = Some(archive_size);
        repo.last_sync = Some(chrono::Utc::now());
        repo.error = None;
        config
            .save(&config_path)
            .map_err(|e| AppError::ConfigError(e.to_string()))?;
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Repository synced successfully",
        "path": archive_path.to_string_lossy(),
        "size": archive_size
    })))
}

pub async fn list_credentials(state: web::Data<AppState>) -> Result<HttpResponse, AppError> {
    let config = state.config.read().await;
    let credentials: Vec<CredentialResponse> = config
        .credentials
        .values()
        .map(|c| CredentialResponse {
            id: c.id.clone(),
            username: c.username.clone(),
        })
        .collect();

    Ok(HttpResponse::Ok().json(credentials))
}

pub async fn add_credential(
    data: web::Json<AddCredentialRequest>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    // Validate that at least one authentication method is provided
    let has_password = !data.password.is_empty();
    let has_ssh_key = data.ssh_key.is_some() && !data.ssh_key.as_ref().unwrap().is_empty();

    if !has_password && !has_ssh_key {
        return Err(AppError::BadRequest(
            "At least one of password or SSH key is required".to_string(),
        ));
    }

    let mut config = state.config.write().await;

    // Encrypt SSH key if provided
    let ssh_key = if let Some(ref key) = data.ssh_key {
        if key.is_empty() {
            None
        } else if key.starts_with("-----BEGIN") || key.contains('\n') {
            // It's plaintext SSH key content - encrypt it
            Some(encryption::encrypt_ssh_key(
                key,
                &config.server.encryption_key,
            )?)
        } else {
            // Reject keys that don't look like SSH key content (could be file paths)
            return Err(AppError::BadRequest(
                "SSH key must be the actual key content, not a file path. Please paste the full SSH private key.".to_string()
            ));
        }
    } else {
        None
    };

    // Encrypt password if provided
    let password = if !data.password.is_empty() {
        Some(encryption::encrypt_password(
            &data.password,
            &config.server.encryption_key,
        )?)
    } else {
        None
    };

    let credential = Credential::try_new(
        Uuid::new_v4().to_string(),
        data.username.clone(),
        password,
        ssh_key,
    )?;

    let response = CredentialResponse {
        id: credential.id.clone(),
        username: credential.username.clone(),
    };

    config.credentials.insert(credential.id.clone(), credential);
    config
        .save(&state.config_path)
        .map_err(|e| AppError::ConfigError(e.to_string()))?;

    Ok(HttpResponse::Created().json(response))
}

pub async fn update_credential(
    path: web::Path<String>,
    data: web::Json<AddCredentialRequest>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let cred_id = path.into_inner();
    let mut config = state.config.write().await;

    // Get encryption key before mutable borrow
    let encryption_key = config.server.encryption_key.clone();

    // Get existing credential data before mutable borrow
    let existing_credential = config
        .credentials
        .get(&cred_id)
        .ok_or_else(|| AppError::NotFound(format!("Credential {} not found", cred_id)))?
        .clone();

    let credential = config
        .credentials
        .get_mut(&cred_id)
        .ok_or_else(|| AppError::NotFound(format!("Credential {} not found", cred_id)))?;

    // Determine what's being updated
    let has_password = !data.password.is_empty();
    let has_ssh_key = data.ssh_key.is_some() && !data.ssh_key.as_ref().unwrap().is_empty();

    // Determine what will exist after update
    let final_password = if has_password {
        // Encrypt the new password
        Some(encryption::encrypt_password(
            &data.password,
            &encryption_key,
        )?)
    } else {
        // Keep existing password (already encrypted or plaintext for backward compatibility)
        existing_credential.password.clone()
    };

    let final_ssh_key = if has_ssh_key {
        // SSH key is provided - encrypt and use it
        let key = data.ssh_key.as_ref().unwrap();
        if key.starts_with("-----BEGIN") || key.contains('\n') {
            // It's plaintext SSH key content - encrypt it
            Some(encryption::encrypt_ssh_key(key, &encryption_key)?)
        } else {
            // Reject keys that don't look like SSH key content (could be file paths)
            return Err(AppError::BadRequest(
                "SSH key must be the actual key content, not a file path. Please paste the full SSH private key.".to_string()
            ));
        }
    } else if has_password {
        // Password is provided but SSH key is not - delete SSH key
        None
    } else {
        // Neither provided - keep existing SSH key
        existing_credential.ssh_key.clone()
    };

    // Validate and update the credential using the constructor
    // We need to create a new credential to validate, then update the existing one
    let _validated = Credential::try_new(
        credential.id.clone(),
        data.username.clone(),
        final_password.clone(),
        final_ssh_key.clone(),
    )?;

    // Update the credential (validation passed)
    credential.username = data.username.clone();
    credential.password = final_password;
    credential.ssh_key = final_ssh_key;

    let response = CredentialResponse {
        id: credential.id.clone(),
        username: credential.username.clone(),
    };

    config
        .save(&state.config_path)
        .map_err(|e| AppError::ConfigError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(response))
}

pub async fn delete_credential(
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let cred_id = path.into_inner();
    let mut config = state.config.write().await;

    // if the credential is in use, return an error
    if config
        .repositories
        .iter()
        .any(|r| r.credential_id == Some(cred_id.clone()))
    {
        return Err(AppError::BadRequest(format!(
            "Credential {} is in use",
            cred_id
        )));
    }

    if config.credentials.remove(&cred_id).is_none() {
        return Err(AppError::NotFound(format!(
            "Credential {} not found",
            cred_id
        )));
    }

    config
        .save(&state.config_path)
        .map_err(|e| AppError::ConfigError(e.to_string()))?;

    Ok(HttpResponse::NoContent().finish())
}

pub async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok"
    }))
}
