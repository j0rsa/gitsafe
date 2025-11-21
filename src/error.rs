use actix_web::{error::ResponseError, http::StatusCode, HttpResponse};
use std::fmt;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Git error: {0}")]
    GitError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Authentication error: {0}")]
    AuthError(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    InternalError(String),
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        match self {
            AppError::AuthError(_) => {
                HttpResponse::Unauthorized().json(serde_json::json!({
                    "error": self.to_string()
                }))
            }
            AppError::NotFound(_) => {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": self.to_string()
                }))
            }
            AppError::BadRequest(_) => {
                HttpResponse::BadRequest().json(serde_json::json!({
                    "error": self.to_string()
                }))
            }
            _ => {
                HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": self.to_string()
                }))
            }
        }
    }

    fn status_code(&self) -> StatusCode {
        match self {
            AppError::AuthError(_) => StatusCode::UNAUTHORIZED,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl From<git2::Error> for AppError {
    fn from(err: git2::Error) -> Self {
        AppError::GitError(err.to_string())
    }
}

impl From<serde_yaml::Error> for AppError {
    fn from(err: serde_yaml::Error) -> Self {
        AppError::ConfigError(err.to_string())
    }
}
