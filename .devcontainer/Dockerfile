FROM mcr.microsoft.com/devcontainers/javascript-node:20-bookworm

# Install all tools and utilities in a single layer for smaller image size
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    # Basic utilities
    curl \
    wget \
    git \
    jq \
    fzf \
    zip \
    unzip \
    # Python dependencies for MCP support
    python3-dev \
    python3-pip \
    python3-venv \
    python3-virtualenv \
    # Clean up to reduce image size
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install Python package manager and UV for Claude MCP support
RUN python3 -m pip install --break-system-packages pipx \
    && pipx install --global uv

# Install Go for Beads CLI (required for 'go install' method)
# Detect architecture and install the correct Go binary
RUN ARCH=$(dpkg --print-architecture) \
    && if [ "$ARCH" = "amd64" ]; then GO_ARCH="amd64"; \
       elif [ "$ARCH" = "arm64" ]; then GO_ARCH="arm64"; \
       else echo "Unsupported architecture: $ARCH" && exit 1; fi \
    && wget -q https://go.dev/dl/go1.24.1.linux-${GO_ARCH}.tar.gz \
    && rm -rf /usr/local/go \
    && tar -C /usr/local -xzf go1.24.1.linux-${GO_ARCH}.tar.gz \
    && rm go1.24.1.linux-${GO_ARCH}.tar.gz

# Add Go to PATH
ENV PATH="/usr/local/go/bin:/home/vscode/go/bin:${PATH}"

# Set working directory
WORKDIR /workspace
