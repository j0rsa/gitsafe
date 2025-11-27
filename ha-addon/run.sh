#!/usr/bin/with-contenv bashio
# ==============================================================================
# Home Assistant Add-on: GitSafe
# Runs the GitSafe application with proper configuration
# ==============================================================================

# Convert Home Assistant options to environment variables
# Home Assistant automatically provides options as environment variables
# but we need to convert them to GITSAFE__ format

if bashio::config.has_value 'host'; then
    export GITSAFE__SERVER__HOST="$(bashio::config 'host')"
fi

if bashio::config.has_value 'jwt_secret'; then
    export GITSAFE__SERVER__JWT_SECRET="$(bashio::config 'jwt_secret')"
fi

if bashio::config.has_value 'encryption_key'; then
    export GITSAFE__SERVER__ENCRYPTION_KEY="$(bashio::config 'encryption_key')"
fi

if bashio::config.has_value 'archive_dir'; then
    export GITSAFE__STORAGE__ARCHIVE_DIR="$(bashio::config 'archive_dir')"
fi

if bashio::config.has_value 'compact'; then
    export GITSAFE__STORAGE__COMPACT="$(bashio::config 'compact')"
fi

if bashio::config.has_value 'cron_expression'; then
    export GITSAFE__SCHEDULER__CRON_EXPRESSION="$(bashio::config 'cron_expression')"
fi

if bashio::config.has_value 'sync_attempts'; then
    export GITSAFE__SERVER__SYNC_ATTEMPTS="$(bashio::config 'sync_attempts')"
fi

if bashio::config.has_value 'skip_auth'; then
    export GITSAFE__SERVER__SKIP_AUTH="$(bashio::config 'skip_auth')"
fi

# Set log level
export RUST_LOG="${RUST_LOG:-info}"

# Run GitSafe
exec ./gitsafe

