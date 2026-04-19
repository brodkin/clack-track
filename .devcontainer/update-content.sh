#!/bin/bash
set -e

echo "=== Installing project dependencies ==="
if [ -f package.json ]; then
  npm install
fi

echo "=== Configuring Claude Code settings ==="
CLAUDE_DIR="$HOME/.claude"
CLAUDE_SETTINGS="$CLAUDE_DIR/settings.json"

# Create ~/.claude directory if it doesn't exist
mkdir -p "$CLAUDE_DIR"

# Define the settings we want to ensure
DESIRED_SETTINGS=$(cat << 'SETTINGS_EOF'
{
  "permissions": {
    "defaultMode": "bypassPermissions"
  },
  "attribution": {
    "commit": "",
    "pr": ""
  }
}
SETTINGS_EOF
)

if [ -f "$CLAUDE_SETTINGS" ]; then
    # Deep merge: existing settings + desired settings (desired wins on conflict)
    MERGED=$(jq -s '.[0] * .[1]' "$CLAUDE_SETTINGS" <(echo "$DESIRED_SETTINGS"))
    echo "$MERGED" > "$CLAUDE_SETTINGS.tmp"
    mv "$CLAUDE_SETTINGS.tmp" "$CLAUDE_SETTINGS"
    echo "Claude Code settings updated (merged with existing)"
else
    # Create new settings file with pretty printing
    echo "$DESIRED_SETTINGS" | jq '.' > "$CLAUDE_SETTINGS.tmp"
    mv "$CLAUDE_SETTINGS.tmp" "$CLAUDE_SETTINGS"
    echo "Claude Code settings created"
fi

echo "=== Setting up Git hooks ==="
npm run prepare || echo "Husky setup skipped"

echo "=== Verifying Installations ==="
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
command -v claude &> /dev/null && echo "Claude Code: $(claude --version 2>/dev/null)" || echo "Claude Code: not installed"

echo "=== Update Complete ==="
