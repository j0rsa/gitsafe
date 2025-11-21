use actix_web::{test, web, App};
use gitsafe::auth::AuthService;
use gitsafe::config::{Config, User};
use gitsafe::git::GitService;
use gitsafe::handlers::{health_check, login, AppState, LoginRequest};
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::RwLock;

#[actix_web::test]
async fn test_health_check() {
    let app = test::init_service(App::new().route("/health", web::get().to(health_check))).await;

    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;

    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_login_success() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("config.yaml");
    
    let auth_service = AuthService::new("test-secret".to_string());
    let password_hash = auth_service.hash_password("testpass").unwrap();
    
    let mut config = Config::default();
    config.users.push(User {
        username: "testuser".to_string(),
        password_hash,
    });
    
    let git_service = GitService::new(temp_dir.path()).unwrap();
    
    let app_state = web::Data::new(AppState {
        config: Arc::new(RwLock::new(config)),
        config_path: config_path.to_string_lossy().to_string(),
        auth_service,
        git_service,
    });

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .route("/api/login", web::post().to(login)),
    )
    .await;

    let login_req = LoginRequest {
        username: "testuser".to_string(),
        password: "testpass".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/api/login")
        .set_json(&login_req)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_login_failure() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("config.yaml");
    
    let auth_service = AuthService::new("test-secret".to_string());
    let password_hash = auth_service.hash_password("testpass").unwrap();
    
    let mut config = Config::default();
    config.users.push(User {
        username: "testuser".to_string(),
        password_hash,
    });
    
    let git_service = GitService::new(temp_dir.path()).unwrap();
    
    let app_state = web::Data::new(AppState {
        config: Arc::new(RwLock::new(config)),
        config_path: config_path.to_string_lossy().to_string(),
        auth_service,
        git_service,
    });

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .route("/api/login", web::post().to(login)),
    )
    .await;

    let login_req = LoginRequest {
        username: "testuser".to_string(),
        password: "wrongpass".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/api/login")
        .set_json(&login_req)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}
