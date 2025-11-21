use gitsafe::auth::AuthService;
use gitsafe::config::User;

// Use this test to generate a password hash for your users
#[test]
fn test_password_hashing() {
    let auth_service = AuthService::new("test-secret".to_string());
    let password = "test-password";
    
    let hash = auth_service.hash_password(password).unwrap();
    
    // Hash should not be empty
    assert!(!hash.is_empty());
    
    // Hash should start with bcrypt prefix
    assert!(hash.starts_with("$2b$"));

    println!("Hash: {}", hash);
}

#[test]
fn test_password_verification() {
    let auth_service = AuthService::new("test-secret".to_string());
    let password = "test-password";
    
    let hash = auth_service.hash_password(password).unwrap();
    
    // Correct password should verify
    assert!(auth_service.verify_password(password, &hash).unwrap());
    
    // Wrong password should not verify
    assert!(!auth_service.verify_password("wrong-password", &hash).unwrap());
}

#[test]
fn test_token_generation_and_verification() {
    let auth_service = AuthService::new("test-secret".to_string());
    let username = "testuser";
    
    // Generate token
    let token = auth_service.generate_token(username).unwrap();
    
    // Token should not be empty
    assert!(!token.is_empty());
    
    // Verify token
    let claims = auth_service.verify_token(&token).unwrap();
    assert_eq!(claims.sub, username);
}

#[test]
fn test_invalid_token_verification() {
    let auth_service = AuthService::new("test-secret".to_string());
    
    // Try to verify an invalid token
    let result = auth_service.verify_token("invalid.token.here");
    assert!(result.is_err());
}

#[test]
fn test_authentication_success() {
    let auth_service = AuthService::new("test-secret".to_string());
    let password = "test-password";
    let hash = auth_service.hash_password(password).unwrap();
    
    let users = vec![User {
        username: "testuser".to_string(),
        password_hash: hash,
    }];
    
    // Authenticate with correct credentials
    let result = auth_service.authenticate("testuser", password, &users);
    assert!(result.is_ok());
    
    let token = result.unwrap();
    assert!(!token.is_empty());
    
    // Verify the token
    let claims = auth_service.verify_token(&token).unwrap();
    assert_eq!(claims.sub, "testuser");
}

#[test]
fn test_authentication_wrong_password() {
    let auth_service = AuthService::new("test-secret".to_string());
    let password = "test-password";
    let hash = auth_service.hash_password(password).unwrap();
    
    let users = vec![User {
        username: "testuser".to_string(),
        password_hash: hash,
    }];
    
    // Authenticate with wrong password
    let result = auth_service.authenticate("testuser", "wrong-password", &users);
    assert!(result.is_err());
}

#[test]
fn test_authentication_nonexistent_user() {
    let auth_service = AuthService::new("test-secret".to_string());
    let users = vec![];
    
    // Authenticate with non-existent user
    let result = auth_service.authenticate("nonexistent", "password", &users);
    assert!(result.is_err());
}
