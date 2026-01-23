#!/bin/bash
set -e

echo "=== Installing Playwright dependencies ==="
sudo apt-get update
sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 libatspi2.0-0 libxshmfence1 \
    default-mysql-client

echo "=== Installing Claude Code (native) ==="
curl -fsSL https://claude.ai/install.sh | bash

echo "=== Installing Beads CLI ==="
sudo npm install -g @beads/bd

echo "=== Fixing Beads volume permissions ==="
sudo chown -R vscode:vscode /workspace/.beads

echo "=== System Setup Complete ==="
