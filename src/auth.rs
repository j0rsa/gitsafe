use crate::config::User;
use crate::error::AppError;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

pub struct AuthService {
    jwt_secret: String,
}

impl AuthService {
    pub fn new(jwt_secret: String) -> Self {
        AuthService { jwt_secret }
    }

    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool, AppError> {
        bcrypt::verify(password, hash)
            .map_err(|e| AppError::AuthError(format!("Password verification failed: {}", e)))
    }

    pub fn hash_password(&self, password: &str) -> Result<String, AppError> {
        bcrypt::hash(password, bcrypt::DEFAULT_COST)
            .map_err(|e| AppError::AuthError(format!("Password hashing failed: {}", e)))
    }

    pub fn authenticate(&self, username: &str, password: &str, users: &[User]) -> Result<String, AppError> {
        let user = users
            .iter()
            .find(|u| u.username == username)
            .ok_or_else(|| AppError::AuthError("Invalid credentials".to_string()))?;

        if !self.verify_password(password, &user.password_hash)? {
            return Err(AppError::AuthError("Invalid credentials".to_string()));
        }

        self.generate_token(username)
    }

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
