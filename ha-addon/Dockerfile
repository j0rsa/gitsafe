# Home Assistant Addon Dockerfile for GitSafe
# Uses pre-built artifacts from CI workflow
# TARGETARCH matches binary directory names: amd64, aarch64

ARG BUILD_FROM
FROM ${BUILD_FROM}

ARG TARGETARCH

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pre-built binary (TARGETARCH matches directory name: amd64 or aarch64)
COPY binary-${TARGETARCH}/gitsafe /app/gitsafe

# Copy static web frontend files
COPY static /app/static

# Copy run script. The Docker image will be built from the ha-addon directory.
COPY run.sh /app/run.sh

RUN chmod +x /app/gitsafe \
    && chmod +x /app/run.sh

# Create necessary directories
RUN mkdir -p /app/archives /app/config

EXPOSE 8080

CMD ["./run.sh"]

