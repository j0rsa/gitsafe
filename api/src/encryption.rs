use crate::error::AppError;
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};

/// Encrypts sensitive data (SSH key or password) using AES-256-GCM.
/// Returns base64-encoded encrypted data with nonce prepended.
///
/// # Arguments
///
/// * `data` - The plaintext data to encrypt (SSH key or password)
/// * `encryption_key` - The encryption key to use
///
/// # Returns
///
/// Returns a base64-encoded string containing the nonce and ciphertext.
///
/// # Errors
///
/// Returns `AppError::InternalError` if encryption fails.
pub fn encrypt_data(data: &str, encryption_key: &str) -> Result<String, AppError> {
    // Derive a 32-byte key from the encryption_key string
    let key_bytes = derive_key(encryption_key);
    let cipher = Aes256Gcm::new(&key_bytes.into());

    // Generate a random nonce
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    // Encrypt the data
    let ciphertext = cipher
        .encrypt(&nonce, data.as_bytes())
        .map_err(|e| AppError::InternalError(format!("Encryption failed: {}", e)))?;

    // Combine nonce and ciphertext, then base64 encode
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(general_purpose::STANDARD.encode(&combined))
}

/// Decrypts base64-encoded encrypted data (SSH key or password).
/// Expects the format: base64(nonce || ciphertext)
///
/// # Arguments
///
/// * `encrypted_data` - Base64-encoded encrypted data
/// * `encryption_key` - The encryption key used for decryption
///
/// # Returns
///
/// Returns the decrypted plaintext string.
///
/// # Errors
///
/// Returns `AppError::InternalError` if:
/// - Base64 decoding fails
/// - The encrypted data format is invalid
/// - Decryption fails
/// - The decrypted data is not valid UTF-8
pub fn decrypt_data(encrypted_data: &str, encryption_key: &str) -> Result<String, AppError> {
    // Decode base64
    let combined = general_purpose::STANDARD
        .decode(encrypted_data)
        .map_err(|e| AppError::InternalError(format!("Base64 decode failed: {}", e)))?;

    // Extract nonce (first 12 bytes for AES-GCM)
    if combined.len() < 12 {
        return Err(AppError::InternalError("Invalid encrypted data format".to_string()));
    }

    let nonce = Nonce::from_slice(&combined[..12]);
    let ciphertext = &combined[12..];

    // Derive the same key
    let key_bytes = derive_key(encryption_key);
    let cipher = Aes256Gcm::new(&key_bytes.into());

    // Decrypt
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::InternalError(format!("Decryption failed: {}", e)))?;

    String::from_utf8(plaintext)
        .map_err(|e| AppError::InternalError(format!("Invalid UTF-8 in decrypted data: {}", e)))
}

/// Encrypts SSH key content using AES-256-GCM.
/// Returns base64-encoded encrypted data with nonce prepended.
///
/// This is a convenience wrapper around `encrypt_data` for SSH keys.
///
/// # Arguments
///
/// * `key_content` - The SSH key content to encrypt
/// * `encryption_key` - The encryption key to use
///
/// # Returns
///
/// Returns a base64-encoded string containing the nonce and ciphertext.
pub fn encrypt_ssh_key(key_content: &str, encryption_key: &str) -> Result<String, AppError> {
    encrypt_data(key_content, encryption_key)
}

/// Decrypts base64-encoded encrypted SSH key.
/// Expects the format: base64(nonce || ciphertext)
///
/// This is a convenience wrapper around `decrypt_data` for SSH keys.
///
/// # Arguments
///
/// * `encrypted_data` - Base64-encoded encrypted SSH key
/// * `encryption_key` - The encryption key used for decryption
///
/// # Returns
///
/// Returns the decrypted SSH key content.
pub fn decrypt_ssh_key(encrypted_data: &str, encryption_key: &str) -> Result<String, AppError> {
    decrypt_data(encrypted_data, encryption_key)
}

/// Encrypts password using AES-256-GCM.
/// Returns base64-encoded encrypted data with nonce prepended.
///
/// This is a convenience wrapper around `encrypt_data` for passwords.
///
/// # Arguments
///
/// * `password` - The password to encrypt
/// * `encryption_key` - The encryption key to use
///
/// # Returns
///
/// Returns a base64-encoded string containing the nonce and ciphertext.
pub fn encrypt_password(password: &str, encryption_key: &str) -> Result<String, AppError> {
    encrypt_data(password, encryption_key)
}

/// Decrypts base64-encoded encrypted password.
/// Expects the format: base64(nonce || ciphertext)
///
/// This is a convenience wrapper around `decrypt_data` for passwords.
/// Also handles backward compatibility: if decryption fails, assumes the
/// password is stored in plaintext and returns it as-is.
///
/// # Arguments
///
/// * `encrypted_data` - Base64-encoded encrypted password (or plaintext for backward compatibility)
/// * `encryption_key` - The encryption key used for decryption
///
/// # Returns
///
/// Returns the decrypted password, or the original string if decryption fails
/// (for backward compatibility with plaintext passwords).
pub fn decrypt_password(encrypted_data: &str, encryption_key: &str) -> String {
    decrypt_data(encrypted_data, encryption_key).unwrap_or_else(|_| encrypted_data.to_string())
}

/// Derives a 32-byte key from a string using SHA-256
fn derive_key(key: &str) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    let hash = hasher.finalize();
    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(&hash);
    key_bytes
}


