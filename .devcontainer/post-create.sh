#!/bin/bash
set -e

echo "🚀 Setting up Development Environment..."

# Ensure we're in the workspace directory
cd /workspace

# Set up user-specific npm global directory for the vscode user
echo "📦 Setting up npm global directory for vscode user..."
mkdir -p /home/vscode/.npm-global
npm config set prefix /home/vscode/.npm-global
export PATH="/home/vscode/.npm-global/bin:$PATH"

# Install Claude Code CLI in user's npm global directory
echo "🤖 Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code

# Update Claude to latest version
echo "🔄 Updating Claude Code to latest version..."
claude update || echo "✅ Claude Code is up to date"

# Install npm dependencies with error recovery
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install || {
        echo "❌ npm install failed - attempting recovery..."
        rm -rf node_modules package-lock.json
        npm install || {
            echo "❌ npm install recovery failed!"
            exit 1
        }
    }
else
    echo "✅ npm dependencies already installed"
fi

# Set up Husky git hooks
echo "🪝 Setting up Git hooks with Husky..."
npm run prepare || echo "⚠️  Husky setup skipped (may need manual setup)"

# IMPORTANT: Combine beads + husky hooks to prevent conflicts
# Beads may install its own hooks later, so we pre-emptively create combined hooks
echo "🔵 Setting up combined beads + husky git hooks..."
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
    echo "✅ Combined git hooks configured (beads + husky)"
else
    echo "⚠️  .git/hooks directory not found - git hooks not configured"
fi

# Set up git config if not already configured
if ! git config --global user.name > /dev/null 2>&1; then
    echo ""
    echo "⚠️  =============================================="
    echo "⚠️  WARNING: Git is using placeholder credentials"
    echo "⚠️  =============================================="
    echo "⚠️  Setting up default git configuration..."
    echo "⚠️  "
    echo "⚠️  🚨 IMPORTANT: Update with your real credentials!"
    echo "⚠️  Run these commands in the terminal:"
    echo "⚠️  "
    echo "⚠️    git config --global user.name 'Your Name'"
    echo "⚠️    git config --global user.email 'your@email.com'"
    echo "⚠️  "
    echo "⚠️  =============================================="
    echo ""
    git config --global user.name "Dev Container"
    git config --global user.email "dev@container.local"
    git config --global init.defaultBranch main
fi

# Test Claude Code availability
if command -v claude &> /dev/null; then
    echo "✅ Claude Code is available"
    claude --version
else
    echo "❌ Claude Code installation failed - checking PATH..."
    echo "PATH: $PATH"
    ls -la /home/vscode/.npm-global/bin/ || echo "npm global bin directory not found"
fi

# Test MCP runtime availability
echo "🤖 Testing MCP runtime availability..."
if command -v npx &> /dev/null && command -v uvx &> /dev/null; then
    echo "✅ MCP runtime ready (npx + uvx available)"
    echo "   MCP servers will be loaded dynamically via Claude Code"
else
    echo "⚠️  MCP runtime incomplete - checking dependencies..."
    command -v npx &> /dev/null && echo "✅ npx available" || echo "❌ npx missing"
    command -v uvx &> /dev/null && echo "✅ uvx available" || echo "❌ uvx missing"
fi

# Install Beads CLI
echo "🔵 Installing Beads CLI..."
if ! command -v bd &> /dev/null; then
    # Method 1: Try universal install script
    echo "   Attempting universal install script..."
    if curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash; then
        export PATH="/home/vscode/go/bin:/home/vscode/.local/bin:$PATH"

        if command -v bd &> /dev/null; then
            echo "✅ Beads CLI installed successfully via universal script"
            bd version
        else
            echo "⚠️  Universal script completed but bd not in PATH yet"
        fi
    else
        echo "⚠️  Universal install script failed, trying Homebrew..."

        # Method 2: Try Homebrew (works on Linux)
        if command -v brew &> /dev/null; then
            echo "   Homebrew detected, installing beads..."
            brew tap steveyegge/beads && brew install bd && \
            echo "✅ Beads CLI installed successfully via Homebrew" || \
            echo "❌ Homebrew installation failed"
        else
            # Method 3: Direct go install with proper GOPATH
            echo "   Trying direct go install..."
            export GOPATH=/home/vscode/go
            export PATH="$GOPATH/bin:$PATH"

            if go install github.com/steveyegge/beads/cmd/bd@latest 2>&1; then
                echo "✅ Beads CLI installed successfully via go install"
            else
                echo "❌ All installation methods failed"
                echo "   Please install manually after container starts:"
                echo "   1. Check Go version matches your architecture: go version"
                echo "   2. Try: go install github.com/steveyegge/beads/cmd/bd@latest"
                echo "   3. Or use Homebrew: brew tap steveyegge/beads && brew install bd"
            fi
        fi
    fi

    # Final verification
    export PATH="/home/vscode/go/bin:/home/vscode/.local/bin:$PATH"
    if command -v bd &> /dev/null; then
        echo "✅ Beads CLI is available"
        bd version
    else
        echo "⚠️  Beads CLI will be available after restarting the terminal"
        echo "   PATH should include: /home/vscode/go/bin"
    fi
else
    echo "✅ Beads CLI already installed"
    bd version
fi

# Install Beads MCP Server via Claude Code plugin
echo "🔵 Installing Beads MCP Server..."
if command -v claude &> /dev/null; then
    # Add beads marketplace
    echo "   Adding beads marketplace..."
    if claude plugin marketplace add steveyegge/beads; then
        echo "✅ Beads marketplace added successfully"
    else
        echo "⚠️  Beads marketplace already added or failed to add"
    fi

    # Install beads plugin
    echo "   Installing beads plugin..."
    if claude plugin install beads; then
        echo "✅ Beads MCP plugin installed successfully"
    else
        echo "⚠️  Beads plugin installation failed or already installed"
        echo "   You can manually install it later with:"
        echo "   claude plugin marketplace add steveyegge/beads"
        echo "   claude plugin install beads"
    fi
else
    echo "❌ Claude Code not available - cannot install Beads MCP plugin"
    echo "   Please ensure Claude Code is installed first"
fi

echo ""
echo "✅ Development environment setup complete!"
echo ""
