use crate::error::AppError;
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};

/// Encrypts SSH key content using AES-256-GCM
/// Returns base64-encoded encrypted data with nonce prepended
pub fn encrypt_ssh_key(key_content: &str, encryption_key: &str) -> Result<String, AppError> {
    // Derive a 32-byte key from the encryption_key string
    let key_bytes = derive_key(encryption_key);
    let cipher = Aes256Gcm::new(&key_bytes.into());

    // Generate a random nonce
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    // Encrypt the SSH key content
    let ciphertext = cipher
        .encrypt(&nonce, key_content.as_bytes())
        .map_err(|e| AppError::InternalError(format!("Encryption failed: {}", e)))?;

    // Combine nonce and ciphertext, then base64 encode
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(general_purpose::STANDARD.encode(&combined))
}

/// Decrypts base64-encoded encrypted SSH key
/// Expects the format: base64(nonce || ciphertext)
pub fn decrypt_ssh_key(encrypted_data: &str, encryption_key: &str) -> Result<String, AppError> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let encryption_key = "test-encryption-key-12345";
        let ssh_key = "-----BEGIN OPENSSH PRIVATE KEY-----\nkey content here\n-----END OPENSSH PRIVATE KEY-----";

        let encrypted = encrypt_ssh_key(ssh_key, encryption_key).unwrap();
        assert_ne!(encrypted, ssh_key);
        assert!(!encrypted.contains("BEGIN"));

        let decrypted = decrypt_ssh_key(&encrypted, encryption_key).unwrap();
        assert_eq!(decrypted, ssh_key);
    }

    #[test]
    fn test_wrong_key_fails() {
        let encryption_key = "test-encryption-key-12345";
        let wrong_key = "wrong-key";
        let ssh_key = "-----BEGIN OPENSSH PRIVATE KEY-----\nkey content\n-----END OPENSSH PRIVATE KEY-----";

        let encrypted = encrypt_ssh_key(ssh_key, encryption_key).unwrap();
        let result = decrypt_ssh_key(&encrypted, wrong_key);
        assert!(result.is_err());
    }
}

