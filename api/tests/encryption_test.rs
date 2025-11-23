use gitsafe::encryption::*;

#[test]
fn test_encrypt_decrypt_ssh_key() {
    let encryption_key = "test-encryption-key-12345";
    let ssh_key =
        "-----BEGIN OPENSSH PRIVATE KEY-----\nkey content here\n-----END OPENSSH PRIVATE KEY-----";

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
    let ssh_key =
        "-----BEGIN OPENSSH PRIVATE KEY-----\nkey content\n-----END OPENSSH PRIVATE KEY-----";

    let encrypted = encrypt_ssh_key(ssh_key, encryption_key).unwrap();
    let result = decrypt_ssh_key(&encrypted, wrong_key);
    assert!(result.is_err());
}

#[test]
fn test_encrypt_decrypt_password() {
    let encryption_key = "test-encryption-key-12345";
    let password = "my-secret-password-123";

    let encrypted = encrypt_password(password, encryption_key).unwrap();
    assert_ne!(encrypted, password);

    let decrypted = decrypt_password(&encrypted, encryption_key);
    assert_eq!(decrypted, password);
}

#[test]
fn test_decrypt_password_backward_compatibility() {
    let encryption_key = "test-encryption-key-12345";
    let plaintext_password = "plaintext-password";

    // decrypt_password should return plaintext if decryption fails (backward compatibility)
    let result = decrypt_password(plaintext_password, encryption_key);
    assert_eq!(result, plaintext_password);
}

#[test]
fn test_encrypt_data_generic() {
    let encryption_key = "test-encryption-key-12345";
    let data = "some-sensitive-data";

    let encrypted = encrypt_data(data, encryption_key).unwrap();
    assert_ne!(encrypted, data);

    let decrypted = decrypt_data(&encrypted, encryption_key).unwrap();
    assert_eq!(decrypted, data);
}
