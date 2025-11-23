pub mod auth;
pub mod config;
pub mod config_persistence;
pub mod encryption;
pub mod error;
pub mod git;
pub mod handlers;
pub mod middleware;
mod scheduler;
mod webhooks;

use crate::config::Config;
use crate::handlers::AppState;
use crate::middleware::AuthMiddleware;
use actix_files as fs;
use actix_web::{web, App, HttpServer, Result};
use log::info;
use std::env;
use std::fs as std_fs;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

const DEFAULT_CONFIG_PATH: &str = "config.yaml";

fn get_config_path() -> String {
    env::var("CONFIG_PATH").unwrap_or_else(|_| DEFAULT_CONFIG_PATH.to_string())
}

const STATIC_DIR: &str = "static";

/// SPA catch-all handler: serves index.html for any non-API route
async fn spa_index() -> Result<fs::NamedFile> {
    let index_path = Path::new(STATIC_DIR).join("index.html");
    Ok(fs::NamedFile::open(index_path)?)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    let config_path = get_config_path();
    // Load or create config
    let config = if Path::new(&config_path).exists() {
        Config::load(config_path.clone()).expect("Failed to load config")
    } else {
        let config = Config::default();
        config
            .save(config_path.clone())
            .expect("Failed to save config");
        info!("Created default configuration file at {}", config_path);
        config
    };

    // Create archive directory
    std_fs::create_dir_all(&config.storage.archive_dir)
        .expect("Failed to create archive directory");

    // Create static directory if it doesn't exist (for web frontend)
    let static_dir = Path::new(STATIC_DIR);
    if !static_dir.exists() {
        std_fs::create_dir_all(static_dir).expect("Failed to create static directory");
        info!("Created static directory at {}", static_dir.display());
    }

    let host = config.server.host.clone();
    let port = config.server.port;
    let jwt_secret = config.server.jwt_secret.clone();
    let archive_dir = config.storage.archive_dir.clone();
    let compact = config.storage.compact;

    let config = Arc::new(RwLock::new(config));
    let auth_service = auth::AuthService::new(jwt_secret);
    let git_service =
        git::GitService::new(&archive_dir, compact).expect("Failed to create git service");
    let git_service_arc = Arc::new(git_service);

    // Create config persistence manager
    let config_persistence = config_persistence::ConfigPersistence::new(config_path.clone());

    // Setup scheduler
    let _scheduler = scheduler::setup_scheduler(
        Arc::clone(&config),
        Arc::clone(&git_service_arc),
        config_persistence.clone(),
    )
    .await
    .expect("Failed to setup scheduler");

    info!("Starting server at {}:{}", host, port);

    let app_state = web::Data::new(AppState {
        config: Arc::clone(&config),
        config_path: config_path.clone(),
        auth_service,
        git_service: (*git_service_arc).clone(),
        config_persistence,
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
                    .route(
                        "/repositories/{id}",
                        web::patch().to(handlers::update_repository),
                    )
                    .route(
                        "/repositories/{id}",
                        web::delete().to(handlers::delete_repository),
                    )
                    .route("/sync", web::post().to(handlers::sync_repository))
                    .route("/credentials", web::get().to(handlers::list_credentials))
                    .route("/credentials", web::post().to(handlers::add_credential))
                    .route(
                        "/credentials/{id}",
                        web::patch().to(handlers::update_credential),
                    )
                    .route(
                        "/credentials/{id}",
                        web::delete().to(handlers::delete_credential),
                    ),
            )
            // Serve static files (JS, CSS, images, etc.) from static directory
            .service(
                fs::Files::new("/", STATIC_DIR)
                    .index_file("index.html")
                    .default_handler(web::route().to(spa_index)),
            )
    })
    .bind((host, port))?
    .run()
    .await
}
