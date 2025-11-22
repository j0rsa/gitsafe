use crate::config::User;
use crate::error::AppError;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

/// JWT claims structure containing user information and expiration.
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (username)
    pub sub: String,
    /// Expiration timestamp
    pub exp: usize,
}

/// Service for handling authentication and authorization operations.
///
/// Provides functionality for password hashing/verification and JWT token
/// generation/verification.
pub struct AuthService {
    jwt_secret: String,
}

impl AuthService {
    /// Creates a new AuthService instance.
    ///
    /// # Arguments
    ///
    /// * `jwt_secret` - Secret key used for signing and verifying JWT tokens
    pub fn new(jwt_secret: String) -> Self {
        AuthService { jwt_secret }
    }

    /// Verifies a password against a bcrypt hash.
    ///
    /// # Arguments
    ///
    /// * `password` - Plain text password to verify
    /// * `hash` - Bcrypt hash to compare against
    ///
    /// # Returns
    ///
    /// Returns `Ok(true)` if password matches, `Ok(false)` if it doesn't,
    /// or an error if verification fails.
    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool, AppError> {
        bcrypt::verify(password, hash)
            .map_err(|e| AppError::AuthError(format!("Password verification failed: {}", e)))
    }

    /// Hashes a password using bcrypt.
    ///
    /// # Arguments
    ///
    /// * `password` - Plain text password to hash
    ///
    /// # Returns
    ///
    /// Returns the bcrypt hash string, or an error if hashing fails.
    pub fn hash_password(&self, password: &str) -> Result<String, AppError> {
        bcrypt::hash(password, bcrypt::DEFAULT_COST)
            .map_err(|e| AppError::AuthError(format!("Password hashing failed: {}", e)))
    }

    /// Authenticates a user and returns a JWT token.
    ///
    /// Verifies the username and password against the provided user list,
    /// and if successful, generates a JWT token valid for 24 hours.
    ///
    /// # Arguments
    ///
    /// * `username` - Username to authenticate
    /// * `password` - Password to verify
    /// * `users` - List of users to check against
    ///
    /// # Returns
    ///
    /// Returns a JWT token string on successful authentication, or an error
    /// if credentials are invalid or authentication fails.
    pub fn authenticate(
        &self,
        username: &str,
        password: &str,
        users: &[User],
    ) -> Result<String, AppError> {
        let user = users
            .iter()
            .find(|u| u.username == username)
            .ok_or_else(|| AppError::AuthError("Invalid credentials".to_string()))?;

        if !self.verify_password(password, &user.password_hash)? {
            return Err(AppError::AuthError("Invalid credentials".to_string()));
        }

        self.generate_token(username)
    }

    /// Generates a JWT token for a user.
    ///
    /// The token is valid for 24 hours from the time of generation.
    ///
    /// # Arguments
    ///
    /// * `username` - Username to include in the token
    ///
    /// # Returns
    ///
    /// Returns a JWT token string, or an error if token generation fails.
    pub fn generate_token(&self, username: &str) -> Result<String, AppError> {
        let expiration = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::hours(24))
            .expect("valid timestamp")
            .timestamp() as usize;

        let claims = Claims {
            sub: username.to_owned(),
            exp: expiration,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        )
        .map_err(|e| AppError::AuthError(format!("Token generation failed: {}", e)))
    }

    /// Verifies a JWT token and extracts the claims.
    ///
    /// # Arguments
    ///
    /// * `token` - JWT token string to verify
    ///
    /// # Returns
    ///
    /// Returns the token claims if valid, or an error if verification fails
    /// (e.g., expired, invalid signature, malformed token).
    pub fn verify_token(&self, token: &str) -> Result<Claims, AppError> {
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map(|data| data.claims)
        .map_err(|e| AppError::AuthError(format!("Token verification failed: {}", e)))
    }
}
