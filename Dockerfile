# Build stage
FROM rust:1.91-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src
COPY tests ./tests

# Build release binary
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 gitsafe

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/gitsafe /usr/local/bin/gitsafe

# Create necessary directories
RUN mkdir -p /app/archives && chown -R gitsafe:gitsafe /app

USER gitsafe

# Expose API port
EXPOSE 8080

# Run the application
CMD ["gitsafe"]
