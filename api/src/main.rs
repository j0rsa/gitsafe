pub mod auth;
pub mod config;
pub mod encryption;
pub mod error;
pub mod git;
pub mod handlers;
pub mod middleware;
mod scheduler;

use crate::config::Config;
use crate::handlers::AppState;
use crate::middleware::AuthMiddleware;
use actix_web::{web, App, HttpServer};
use log::info;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

const CONFIG_PATH: &str = "config.yaml";

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    // Load or create config
    let config = if Path::new(CONFIG_PATH).exists() {
        Config::load(CONFIG_PATH).expect("Failed to load config")
    } else {
        let config = Config::default();
        config.save(CONFIG_PATH).expect("Failed to save config");
        info!("Created default configuration file at {}", CONFIG_PATH);
        config
    };

    // Create archive directory
    fs::create_dir_all(&config.storage.archive_dir).expect("Failed to create archive directory");

    let host = config.server.host.clone();
    let port = config.server.port;
    let jwt_secret = config.server.jwt_secret.clone();
    let archive_dir = config.storage.archive_dir.clone();

    let config = Arc::new(RwLock::new(config));
    let auth_service = auth::AuthService::new(jwt_secret);
    let git_service = git::GitService::new(&archive_dir).expect("Failed to create git service");
    let git_service_arc = Arc::new(git_service);

    // Setup scheduler
    let _scheduler = scheduler::setup_scheduler(Arc::clone(&config), Arc::clone(&git_service_arc))
        .await
        .expect("Failed to setup scheduler");

    info!("Starting server at {}:{}", host, port);

    let app_state = web::Data::new(AppState {
        config: Arc::clone(&config),
        config_path: CONFIG_PATH.to_string(),
        auth_service,
        git_service: (*git_service_arc).clone(),
    });

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            // Public routes (no authentication required)
            .route("/health", web::get().to(handlers::health_check))
            .route("/api/login", web::post().to(handlers::login))
            // Protected routes (authentication required)
            .service(
                web::scope("/api")
                    .wrap(AuthMiddleware)
                    .route("/repositories", web::get().to(handlers::list_repositories))
                    .route("/repositories", web::post().to(handlers::add_repository))
                    .route("/repositories/{id}", web::patch().to(handlers::update_repository))
                    .route("/repositories/{id}", web::delete().to(handlers::delete_repository))
                    .route("/sync", web::post().to(handlers::sync_repository))
                    .route("/credentials", web::get().to(handlers::list_credentials))
                    .route("/credentials", web::post().to(handlers::add_credential))
                    .route("/credentials/{id}", web::patch().to(handlers::update_credential))
                    .route("/credentials/{id}", web::delete().to(handlers::delete_credential))
            )
    })
    .bind((host, port))?
    .run()
    .await
}
