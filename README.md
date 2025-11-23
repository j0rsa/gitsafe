# Gitsafe

<p align="center">
  <img src="doc/logo.png" alt="Gitsafe Logo" />
</p>

A Rust application designed to fetch Git repositories on a schedule and keep each repository in a separate tarball archive.

Keep your Git repositories safe and backed up with ease!

## Features

- **Scheduled Git Repository Syncing**: Automatically fetch and archive Git repositories based on a cron schedule
- **Dual Storage Modes**: 
  - **Compact Mode**: Repositories stored as compressed `.tar.gz` archives (space-efficient)
  - **Non-Compact Mode**: Repositories stored as regular folders (faster syncs, incremental updates)
- **Incremental Updates**: Pull changes instead of re-cloning on subsequent syncs
- **Repository Size Tracking**: Track and display repository sizes (archive or cumulative folder size)
- **REST API**: Actix-web based REST API for managing repositories and credentials
- **JWT Authentication**: Secure API endpoints with JWT token-based authentication
- **Credential Management**: Store and manage Git credentials (username/password, SSH keys with encryption)
- **Error Webhooks**: Configure webhook URLs to receive notifications when sync errors occur
- **YAML Configuration**: Simple YAML-based configuration without a database
- **Manual Sync**: Trigger repository synchronization manually via API

## Installation

### Prerequisites

- Rust 1.70 or higher
- Git 2.0 or higher

### Building from source

```bash
git clone https://github.com/j0rsa/gitsafe.git
cd gitsafe
cargo build --release
```

The binary will be available at `target/release/gitsafe`.

### Setting up pre-commit hooks (optional)

This project includes pre-commit hooks that automatically run formatting, checks, and linting before each commit. To install them:

```bash
./scripts/setup-hooks.sh
```

The pre-commit hooks will automatically run:
- `cargo test --all` - Run all tests
- `cargo check --all` - Check compilation
- `cargo clippy --all -- -D warnings` - Lint code with clippy
- `cargo fmt --all -- --check` - Check code formatting

The hooks are stored in `.githooks/` and configured via git's `core.hooksPath` setting. To uninstall, run:

```bash
git config --unset core.hooksPath
```

## Configuration

Create a `config.yaml` file in the same directory as the binary. You can use `config.yaml.example` as a template:

```bash
cp config.yaml.example config.yaml
```

### Configuration Structure

```yaml
server:
  host: "127.0.0.1"
  port: 8080
  jwt_secret: "your-secret-key"
  encryption_key: "your-encryption-key-for-ssh-keys"
  # Optional: List of webhook URLs to notify when sync errors occur
  error_webhooks:
    - "https://example.com/webhook"
    - "https://another-service.com/notify"

storage:
  archive_dir: "./archives"
  # If true, repositories are stored as compressed tarballs (.tar.gz)
  # If false, repositories are stored as regular folders
  compact: true

scheduler:
  # Cron format: "sec min hour day_of_month month day_of_week"
  cron_expression: "0 0 * * * *"  # Every hour

repositories: []

credentials: {}

users:
  - username: "admin"
    password_hash: "$2b$12$..."  # bcrypt hash
```

**Important**: Change the default admin password before running in production!

## Usage

### Starting the Server

```bash
./target/release/gitsafe
```

Or with cargo:

```bash
cargo run --release
```

The server will start on the configured host and port (default: `http://127.0.0.1:8080`).

### Quick Demo

A demo script is included to showcase the API functionality:

```bash
./demo.sh
```

This script will:
1. Check server health
2. Login with default credentials
3. Create a credential
4. Add a public repository
5. List all repositories and credentials

**Note**: Make sure the server is running and you have `jq` installed before running the demo.

### API Endpoints

#### Authentication

**Login**
```bash
curl -X POST http://127.0.0.1:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'
```

Response:
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

#### Repository Management

**List Repositories**
```bash
curl -X GET http://127.0.0.1:8080/api/repositories \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Add Repository**
```bash
curl -X POST http://127.0.0.1:8080/api/repositories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/user/repo.git",
    "credential_id": null
  }'
```

**Delete Repository**
```bash
curl -X DELETE http://127.0.0.1:8080/api/repositories/{id} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Manually Sync Repository**
```bash
curl -X POST http://127.0.0.1:8080/api/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repository_id": "REPO_ID"}'
```

#### Credential Management

**List Credentials**
```bash
curl -X GET http://127.0.0.1:8080/api/credentials \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Add Credential**
```bash
curl -X POST http://127.0.0.1:8080/api/credentials \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "git_user",
    "password": "git_password",
    "ssh_key": null
  }'
```

For SSH key authentication:
```bash
curl -X POST http://127.0.0.1:8080/api/credentials \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "git",
    "password": "",
    "ssh_key": "/path/to/private/key"
  }'
```

**Delete Credential**
```bash
curl -X DELETE http://127.0.0.1:8080/api/credentials/{id} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Health Check

```bash
curl http://127.0.0.1:8080/health
```

## Scheduler

The scheduler runs based on the cron expression defined in `config.yaml`. The default configuration syncs all enabled repositories every hour.

### Cron Expression Format

The cron expression follows the format: `sec min hour day_of_month month day_of_week`

Examples:
- `0 0 * * * *` - Every hour at minute 0
- `0 */30 * * * *` - Every 30 minutes
- `0 0 */6 * * *` - Every 6 hours
- `0 0 2 * * *` - Every day at 2:00 AM

## Storage Modes

GitSafe supports two storage modes configured via `storage.compact`:

### Compact Mode (default)

Repositories are stored as compressed `.tar.gz` archives. On each sync:
1. Existing archive is unpacked (if present)
2. Changes are pulled from remote
3. New archive is created
4. Temporary files are cleaned up

**Archive naming**: `{domain}_{user}_{repo}.tar.gz`
- Example: `github_com-example-repo1.tar.gz`

### Non-Compact Mode

Repositories are stored as regular folders. On each sync:
1. Repository is cloned (if new) or updated via pull (if exists)
2. Cumulative folder size is calculated

**Folder naming**: `{domain}_{user}_{repo}`
- Example: `github_com-example-repo1`

### Repository Name Generation

Repository names are automatically generated from URLs to prevent collisions:
- Domain dots are replaced with underscores: `github.com` → `github_com`
- Path segments are joined with dashes: `example/repo1` → `example-repo1`
- `.git` suffix is automatically removed
- Example: `https://github.com/example/repo1.git` → `github_com-example-repo1`

## Error Webhooks

Configure webhook URLs in `server.error_webhooks` to receive notifications when repository sync errors occur. Each webhook receives a POST request with the following JSON payload:

```json
{
  "time": "2024-01-01T12:00:00Z",
  "repo": {
    "id": "repo-123",
    "url": "https://github.com/user/repo.git",
    "enabled": true
  },
  "operation": "sync",
  "credential_id": "cred-456",
  "error_message": "Failed to clone repository: ..."
}
```

Webhook calls are:
- **Non-blocking**: Sent asynchronously without affecting sync operations
- **Fault-tolerant**: Failures are logged but don't interrupt the main flow
- **Timeout-protected**: 10-second timeout per webhook

## Security Considerations

1. **Change Default Credentials**: The default admin password is `admin`. Change it immediately in production.
2. **JWT Secret**: Use a strong, random secret for JWT token generation.
3. **Encryption Key**: Use a strong, random key for SSH key encryption (different from JWT secret).
4. **HTTPS**: Use a reverse proxy (nginx, caddy) to enable HTTPS in production.
5. **SSH Key Encryption**: SSH keys are encrypted using AES-256-GCM before storage.
6. **File Permissions**: Set restrictive permissions on `config.yaml`: `chmod 600 config.yaml`

## Libraries Used

- **actix-web**: Web framework
- **git2**: Git operations
- **auth-git2**: Git authentication helpers
- **tokio-cron-scheduler**: Scheduled task execution
- **serde_yaml_ng**: YAML configuration parsing (maintained fork of serde_yaml)
- **jsonwebtoken**: JWT authentication
- **bcrypt**: Password hashing
- **tar & flate2**: Archive creation and compression
- **reqwest**: HTTP client for webhook notifications
- **aes-gcm**: AES-256-GCM encryption for SSH keys
- **chrono**: Date and time handling

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

- **Lint**: Runs `cargo fmt` and `cargo clippy` on every PR (formatting is checked first for fast feedback)
- **Build**: Compiles the project in release mode
- **Test**: Runs all unit and integration tests
- **Security Audit**: Checks dependencies for known vulnerabilities using `cargo audit`
- **Docker**: Uses an optimized multi-stage build process:
  - **Binary Build**: Compiles binaries for amd64 and arm64 in parallel using matrix builds
  - **Docker Build**: Creates architecture-specific images using pre-built binaries (fast, no QEMU emulation)
  - **Manifest Creation**: Combines images into a multi-arch manifest on main branch
  - Images are built on PRs for verification but only pushed to GitHub Container Registry (`ghcr.io`) on main branch

### Docker Images

Docker images are:
- **Built on PRs**: Verified for correctness but not pushed to the registry
- **Built and pushed on main branch**: Tagged with branch name and commit SHA
- **Multi-architecture**: Supports both `linux/amd64` and `linux/arm64` (aarch64) platforms
- **Optimized build**: Binaries are built natively for each architecture in parallel for faster CI times

Images pushed to GitHub Container Registry are tagged with:
- `main` or `master`: Branch reference tag
- `sha-<commit>`: Commit SHA tag

To run the Docker image from main:

```bash
docker run -d -p 8080:8080 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/archives:/app/archives \
  ghcr.io/j0rsa/gitsafe:main
```

Docker will automatically pull the correct image for your platform (amd64 or arm64).

### Required Secrets

The CI pipeline uses the built-in `GITHUB_TOKEN` for pushing Docker images to GitHub Container Registry. No additional secrets need to be configured.

## License

See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
