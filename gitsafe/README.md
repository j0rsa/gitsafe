# GitSafe Home Assistant Addon

GitSafe is an automated Git repository backup and synchronization tool that runs as a Home Assistant addon.

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
- **Web UI**: Modern web interface accessible through Home Assistant Ingress

## Installation

1. Add this repository to your Home Assistant addon store (if available) or install manually
2. Navigate to **Settings** → **Add-ons** → **Add-on Store**
3. Find **GitSafe** and click **Install**
4. Configure the addon options (see Configuration below)
5. Click **Start**

## Configuration

### Options

- **host**: Server host address (default: `0.0.0.0`)
- **port**: Server port (default: `8080`)
- **jwt_secret**: Secret key for JWT token generation (required, use a long random string)
- **encryption_key**: Encryption key for SSH keys (required, use a long random string, different from jwt_secret)
- **archive_dir**: Directory for storing repository archives (default: `/share/gitsafe/archives`)
- **compact**: Enable compact mode (tarball archives) (default: `true`)
- **cron_expression**: Cron expression for scheduled syncs (default: `0 0 * * * *` - every hour)
- **sync_attempts**: Number of sync attempts before disabling a repository (default: `5`)

### Cron Expression Format

The cron expression follows the format: `sec min hour day_of_month month day_of_week`

Examples:
- `0 0 * * * *` - Every hour at minute 0
- `0 */30 * * * *` - Every 30 minutes
- `0 0 */6 * * *` - Every 6 hours
- `0 0 2 * * *` - Every day at 2:00 AM

### Initial Setup

After starting the addon:

1. Access the web UI through Home Assistant Ingress (click the **OPEN WEB UI** button)
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin`
3. **IMPORTANT**: Change the default password immediately in the configuration
4. Add credentials for your Git repositories (if needed)
5. Add repositories to sync

## Usage

### Web UI

The GitSafe web UI is accessible through Home Assistant Ingress. Click the **OPEN WEB UI** button in the addon panel to access it.

### API Endpoints

All API endpoints are available at `/api/`:

- `POST /api/login` - Authenticate and get JWT token
- `GET /api/repositories` - List all repositories
- `POST /api/repositories` - Add a new repository
- `DELETE /api/repositories/{id}` - Delete a repository
- `POST /api/sync` - Manually sync a repository
- `GET /api/credentials` - List all credentials
- `POST /api/credentials` - Add a new credential
- `DELETE /api/credentials/{id}` - Delete a credential
- `GET /health` - Health check endpoint

### Storage

Repository archives are stored in `/share/gitsafe/archives` by default, which is mapped to your Home Assistant `share` directory. This ensures data persistence across addon updates.

## Security Considerations

1. **Change Default Credentials**: The default admin password is `admin`. Change it immediately after first login.
2. **JWT Secret**: Use a strong, random secret for JWT token generation.
3. **Encryption Key**: Use a strong, random key for SSH key encryption (different from JWT secret).
4. **Network Access**: The addon runs on your Home Assistant network. Consider firewall rules if exposing ports.

## Support

For issues, feature requests, or contributions, please visit the [GitHub repository](https://github.com/j0rsa/gitsafe).

## License

See the main repository [LICENSE](../LICENSE) file for details.


