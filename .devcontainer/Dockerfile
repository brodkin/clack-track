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
    # ACLI dependencies
    gnupg2 \
    # Install Atlassian CLI (acli) for Jira integration
    && mkdir -p -m 755 /etc/apt/keyrings \
    && wget -nv -O- https://acli.atlassian.com/gpg/public-key.asc | gpg --dearmor -o /etc/apt/keyrings/acli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/acli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/acli-archive-keyring.gpg] https://acli.atlassian.com/linux/deb stable main" | tee /etc/apt/sources.list.d/acli.list > /dev/null \
    && apt-get update \
    && apt-get install -y acli \
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

# Playwright browser dependencies for ARM64 Chromium (screenshot/console debugging)
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libatspi2.0-0 libxshmfence1 \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace
