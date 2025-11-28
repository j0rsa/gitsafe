# Home Assistant Addon Dockerfile for GitSafe
# Uses pre-built artifacts from CI workflow
# TARGETARCH matches binary directory names: amd64, aarch64
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-ubuntu:20.04

FROM ${BUILD_FROM}

ARG TARGETARCH

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    git \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Create .ssh directory and add known host keys for GitHub and GitLab
# This allows SSH connections without host key verification errors
RUN mkdir -p /root/.ssh && \
    ssh-keyscan github.com >> /root/.ssh/known_hosts 2>/dev/null && \
    ssh-keyscan gitlab.com >> /root/.ssh/known_hosts 2>/dev/null && \
    ssh-keyscan ssh.github.com >> /root/.ssh/known_hosts 2>/dev/null && \
    chmod 600 /root/.ssh/known_hosts

WORKDIR /app

# Copy pre-built binary (TARGETARCH matches directory name: amd64 or aarch64)
COPY binary-${TARGETARCH}/gitsafe /app/gitsafe

# Copy static web frontend files
COPY web-static /app/static

# Copy run script. The Docker image will be built from the ha-addon directory.
COPY run.sh /app/run.sh

RUN chmod +x /app/gitsafe \
    && chmod +x /app/run.sh

# Create necessary directories
RUN mkdir -p /app/archives /app/config

EXPOSE 8080

CMD ["./run.sh"]

