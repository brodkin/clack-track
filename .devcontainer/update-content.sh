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

# Combined beads + husky hooks setup
echo "=== Setting up combined beads + husky git hooks ==="
if [ -d .git/hooks ]; then
    # Create combined pre-commit hook
    cat > .git/hooks/pre-commit << 'HOOK_EOF'
#!/bin/sh
#
# Combined hook: bd (beads) + husky pre-commit
#

# ===== BEADS SECTION =====
# Flush pending bd changes before commit

if command -v bd >/dev/null 2>&1 && [ -d .beads ]; then
    # Flush pending changes to JSONL
    if ! bd sync --flush-only >/dev/null 2>&1; then
        echo "Error: Failed to flush bd changes to JSONL" >&2
        echo "Run 'bd sync --flush-only' manually to diagnose" >&2
        exit 1
    fi

    # If the JSONL file was modified, stage it
    if [ -f .beads/issues.jsonl ]; then
        git add .beads/issues.jsonl 2>/dev/null || true
    fi
fi

# ===== HUSKY SECTION =====
# Run husky pre-commit hook

# Run type checking
npm run typecheck || exit 1

# Run linting with auto-fix
npm run lint:fix || exit 1

# Run prettier on staged files
npx prettier --write --ignore-unknown .

# Re-stage files modified by prettier and linting
git add -u

exit 0
HOOK_EOF

    # Ensure commit-msg hook exists for commitlint
    if [ ! -f .git/hooks/commit-msg ]; then
        cat > .git/hooks/commit-msg << 'COMMIT_MSG_EOF'
#!/usr/bin/env sh

npx --no -- commitlint --edit $1
COMMIT_MSG_EOF
    fi

    chmod +x .git/hooks/pre-commit .git/hooks/commit-msg
    echo "Combined git hooks configured (beads + husky)"
else
    echo ".git/hooks directory not found - git hooks not configured"
fi

echo "=== Configuring Beads ==="
if command -v bd &> /dev/null; then
  cd /workspace
  if ! bd info &> /dev/null 2>&1; then
    echo "Initializing Beads with sync branch: $BEADS_SYNC_BRANCH"
    bd init --branch "${BEADS_SYNC_BRANCH:-beads-sync}"
    bd hooks install --force
  fi
fi

echo "=== Verifying Installations ==="
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
command -v claude &> /dev/null && echo "Claude Code: $(claude --version 2>/dev/null)" || echo "Claude Code: not installed"
command -v bd &> /dev/null && echo "Beads: $(bd --version 2>/dev/null)" || echo "Beads: not installed"

echo "=== Update Complete ==="
