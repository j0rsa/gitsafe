//! GitSafe - A Rust application for fetching and archiving Git repositories.
//!
//! This library provides functionality for:
//! - Scheduled Git repository synchronization
//! - Repository archiving (compact tarball or folder storage)
//! - REST API for repository and credential management
//! - JWT-based authentication
//! - Error webhook notifications

pub mod auth;
pub mod config;
pub mod encryption;
pub mod error;
pub mod git;
pub mod handlers;
pub mod middleware;
pub mod webhooks;