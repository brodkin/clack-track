# Clack Track

> A Node.js application that updates Vestaboards over their local API with AI-generated content

## Overview

Clack Track is a smart display manager for Vestaboard that leverages AI to generate and push engaging content to your Vestaboard device via its local API. Perfect for displaying dynamic messages, information, and creative content on your Vestaboard.

## Features

- 📺 **Vestaboard Local API Integration** - Direct communication with your Vestaboard device
- 🤖 **AI-Powered Content Generation** - Automatically creates engaging messages and content
- 🔄 **Dynamic Updates** - Push new content to your board on demand or on a schedule
- 🚀 **Built with Node.js 20** - Modern JavaScript runtime
- 🐳 **Devcontainer Support** - Consistent development environments
- 🌲 **Git Worktree Workflow** - Parallel development made easy
- ✨ **Code Quality** - Prettier formatting, commitlint, and TDD methodology

## Prerequisites

- **Vestaboard Device** with local API enabled
- **Vestaboard Local API Key** - Obtain from your Vestaboard settings
- Node.js 20 or higher
- npm or yarn
- Docker Desktop (optional, for devcontainer development)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd clack-track

# Install dependencies
npm install

# Configure your Vestaboard
# Create a .env file with your Vestaboard local API credentials
cp .env.example .env
# Edit .env and add your:
# - VESTABOARD_LOCAL_API_KEY
# - VESTABOARD_LOCAL_API_URL (typically http://<your-vestaboard-ip>:7000)
```

## Configuration

### Getting Your Vestaboard Local API Key

1. Open the Vestaboard mobile app
2. Go to Settings → Local API
3. Enable the Local API
4. Copy your API key and note your board's IP address
5. Add these to your `.env` file:
   ```
   VESTABOARD_LOCAL_API_KEY=your-api-key-here
   VESTABOARD_LOCAL_API_URL=http://your-board-ip:7000
   ```

## Development

### Using Devcontainer (Recommended)

This project includes a devcontainer configuration for a consistent development environment.

1. Open the project in VS Code
2. Install the "Dev Containers" extension
3. Click "Reopen in Container" when prompted
4. The container will build and install all dependencies automatically

### Local Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

## Project Structure

```
clack-track/
├── .devcontainer/       # Devcontainer configuration
├── .husky/              # Git hooks (commitlint, prettier)
├── trees/               # Git worktrees for parallel development
├── src/                 # Source code
│   ├── api/            # Vestaboard API client
│   ├── content/        # AI content generation
│   └── utils/          # Utility functions
├── tests/               # Test files
├── .env.example         # Environment variables template
├── commitlint.config.js # Commit message linting
└── README.md
```

## Git Workflow

This project uses git worktrees for isolated feature development:

```bash
# Create a new worktree for a feature
mkdir -p trees
git worktree add ./trees/PROJ-123-feature-name -b feature/PROJ-123-feature-name develop

# Work in the worktree
cd ./trees/PROJ-123-feature-name

# Clean up after merge
git worktree remove ./trees/PROJ-123-feature-name
git branch -d feature/PROJ-123-feature-name
```

## Contributing

We welcome contributions! This project follows the SPICE development standards:

1. **Create a worktree** for your feature/fix

   ```bash
   mkdir -p trees
   git worktree add ./trees/feature-name -b feature/feature-name develop
   ```

2. **Follow TDD methodology** (Red-Green-Refactor)
   - Write failing tests first
   - Implement minimal code to pass
   - Refactor for quality

3. **Quality requirements**
   - Ensure 80%+ test coverage
   - All linting must pass
   - Conventional commit messages (enforced by commitlint)

4. **Commit format**

   ```
   feat(scope): description (max 72 chars)

   Optional body text
   ```

5. **Merge to develop** (not main)
   - All PRs should target the `develop` branch
   - Main branch is for releases only

## Usage

```bash
# Send a message to your Vestaboard
npm run send -- "Hello, World!"

# Generate AI content and display it
npm run generate

# Start the service for scheduled updates
npm start
```

## Development Scripts

```bash
npm run dev       # Start development server with hot reload
npm test          # Run test suite
npm run lint      # Run linter
npm run format    # Format code with Prettier
npm run build     # Build for production
```

## License

[License type to be determined]

## Author

Built with Claude Code

---

For more information, please contact [maintainer contact info]
