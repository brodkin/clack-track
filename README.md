# Clack Track

> A Node.js application that updates Vestaboards over their local API with AI-generated content

## Overview

Clack Track is a smart display manager for Vestaboard split-flap displays that creates engaging, AI-powered content and displays it via the Vestaboard local API. The system intelligently manages content updates through two modes:

- **Major Updates**: Full content refreshes triggered by Home Assistant events or manual CLI commands, generating fresh quotes, news, weather, and custom content
- **Minor Updates**: Every-minute time and weather updates that preserve the main content while keeping information current

The application provides a web debugging interface for content management, quality voting, and system logs.

## Features

- 📺 **Vestaboard Local API Integration** - Direct communication with your Vestaboard device
- 🤖 **AI-Powered Content Generation** - Support for OpenAI GPT and Anthropic Claude Sonnet
- 🔄 **Dual Update System** - Major updates for new content, minor updates for time/weather
- 🏠 **Home Assistant Integration** - Event-driven content triggers from your smart home
- 📰 **Rich Data Sources** - RSS feeds, RapidAPI integrations, and weather data
- 🎯 **Prompt Management** - Organized system and user prompts for customizable AI behavior
- 🌐 **Web Debugging Interface** - View content, vote on quality, and access debug logs
- 🚀 **Built with Node.js 20** - Modern JavaScript runtime with TypeScript
- 🐳 **Devcontainer Support** - Consistent development environments
- 🌲 **Git Worktree Workflow** - Parallel development made easy
- ✨ **Code Quality** - Prettier formatting, commitlint, and TDD methodology

## System Architecture

### AI Providers

Clack Track supports multiple AI providers for flexible content generation:

- **OpenAI GPT** - GPT-4 and GPT-3.5-turbo models for creative content
- **Anthropic Claude Sonnet** - Claude 3.5 Sonnet for nuanced, contextual responses

Configure your preferred provider via environment variables. The system uses structured prompts from the `prompts/` directory to guide AI content generation.

### Data Sources

Content is enriched with real-time data from multiple sources:

- **RSS Feeds** - News summaries and headlines from configured RSS sources
- **RapidAPI** - Weather, events, and other third-party API data
- **Home Assistant API** - Smart home event triggers and sensor data

### Update Mechanism

The system operates in two distinct modes:

#### Major Updates
Triggered by:
- Home Assistant events (e.g., "person arrived home", "door opened")
- Manual CLI commands
- Scheduled intervals (configurable)

Generates completely new content including:
- Motivational quotes
- News summaries
- Weather forecasts
- Custom content types

#### Minor Updates
- Runs every minute on the minute
- Updates only time and current weather
- Preserves the main content from the last major update
- Minimal API calls for efficiency

### Prompts System

AI behavior is controlled through organized text file prompts in the `prompts/` directory:

```
prompts/
├── system/              # System-level prompts (role, constraints)
│   ├── major-update-base.txt
│   └── minor-update-base.txt
└── user/                # Content type prompts
    ├── motivational.txt
    ├── news-summary.txt
    ├── weather-focus.txt
    └── custom.txt
```

System prompts define the AI's role and Vestaboard formatting constraints (6 rows × 22 characters). User prompts specify content types and requirements.

### Web Interface

A debugging web interface provides:
- **Latest Content View** - See what's currently on your Vestaboard
- **Quality Voting** - Flag content as good or bad for AI training
- **Debug Logs** - System logs, API calls, and error tracking
- **Content History** - Review past generated content

## Prerequisites

- **Vestaboard Device** with local API enabled
- **Vestaboard Local API Key** - Obtain from your Vestaboard settings
- **AI Provider API Key** - OpenAI or Anthropic account (or both)
- Node.js 20 or higher
- npm or yarn
- Docker Desktop (optional, for devcontainer development)
- Home Assistant instance (optional, for event-driven updates)

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

### AI Provider Configuration

Choose at least one AI provider and add the corresponding API key to your `.env` file:

**OpenAI:**
```
OPENAI_API_KEY=sk-...
```

**Anthropic:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

### Additional Configuration

Configure update behavior and content preferences in `.env`:

```
UPDATE_INTERVAL=60              # Minutes between major updates
DEFAULT_CONTENT_TYPE=quote      # quote, weather, news, custom
HOME_ASSISTANT_URL=http://...   # Optional: Home Assistant instance
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
│   ├── api/            # Vestaboard and AI API clients
│   │   ├── ai/         # OpenAI and Anthropic integrations
│   │   └── data-sources/ # RSS, RapidAPI, Home Assistant
│   ├── content/        # AI content generation
│   │   ├── generators/ # Major and minor update strategies
│   │   └── formatters/ # Vestaboard text layout
│   ├── scheduler/      # Cron and event-based updates
│   ├── storage/        # Database and data persistence
│   ├── web/            # Debugging web interface
│   │   ├── routes/     # API endpoints
│   │   └── pages/      # HTML pages
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── prompts/             # AI prompt templates
│   ├── system/         # System prompts (role, constraints)
│   └── user/           # Content type prompts
├── tests/               # Test files (see Testing section below)
│   ├── unit/           # Isolated component tests
│   ├── integration/    # Multi-component tests
│   ├── e2e/            # End-to-end system tests
│   ├── web/            # Web UI tests (debugging interface)
│   ├── __mocks__/      # Shared mock implementations
│   ├── fixtures/       # Test data files
│   └── setup/          # Test configuration
├── .env.example         # Environment variables template
├── commitlint.config.js # Commit message linting
├── jest.config.cjs      # Jest testing configuration
└── README.md
```

## Git Workflow

This project uses git worktrees for isolated feature development:

```bash
# Create a new worktree for a feature
mkdir -p trees
git worktree add ./trees/feature-name -b feature/feature-name main

# Work in the worktree
cd ./trees/feature-name

# Clean up after merge
git worktree remove ./trees/feature-name
git branch -d feature/feature-name
```

## Testing

Clack Track uses a comprehensive testing strategy with Jest to ensure code quality and reliability. The test suite is organized into four main categories:

### Test Directory Structure

```
tests/
├── unit/                    # Isolated component tests
│   ├── api/                 # VestaboardClient tests
│   ├── content/             # ContentGenerator tests
│   ├── utils/               # Logger, helpers tests
│   └── web/                 # Web UI component tests
├── integration/             # Multi-component tests
│   ├── content-to-board/    # ContentGenerator → VestaboardClient flows
│   └── api-workflows/       # Full API interaction flows
├── e2e/                     # End-to-end system tests
│   └── workflows/           # Complete user workflows
├── web/                     # Web UI debugging interface tests
│   ├── components/          # UI component tests
│   ├── pages/               # Page-level tests
│   └── api-routes/          # Web API endpoint tests
├── __mocks__/               # Shared mock implementations
├── fixtures/                # Test data files (JSON)
└── setup/
    └── jest.setup.ts        # Global test configuration
```

### Test Types

1. **Unit Tests** (`tests/unit/`)
   - Test individual components in isolation
   - Mock all external dependencies
   - Fast execution, high coverage
   - Run with: `npm run test:unit`

2. **Integration Tests** (`tests/integration/`)
   - Test how components work together
   - Mock external APIs (Vestaboard, OpenAI, Anthropic)
   - Verify data flow between modules
   - Run with: `npm run test:integration`

3. **E2E Tests** (`tests/e2e/`)
   - Test complete user workflows
   - Simulate real-world scenarios
   - Longer execution time (60s timeout)
   - Run with: `npm run test:e2e`

4. **Web UI Tests** (`tests/web/`)
   - Test debugging interface components
   - Uses jsdom environment for DOM testing
   - Test UI interactions and rendering
   - Run with: `npm run test:web`

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e           # E2E tests only
npm run test:web           # Web UI tests only

# Run all tests with coverage
npm run test:all

# Watch mode (re-run on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Mocking Strategy

All external dependencies are mocked for reliable, fast testing:

- **Vestaboard API**: HTTP calls mocked in `tests/__mocks__/vestaboard-api.ts`
- **AI Providers**: OpenAI/Anthropic responses mocked in `tests/__mocks__/ai-providers.ts`
- **Test Fixtures**: Sample data stored in `tests/fixtures/*.json`

### Coverage Requirements

- **Minimum threshold**: 80% coverage (branches, functions, lines, statements)
- **Excludes**: Type definition files, index files
- **Reports**: Generated in `coverage/` directory

### Writing Tests

Tests follow TDD (Test-Driven Development) methodology:

```typescript
// Example: tests/unit/api/vestaboard.test.ts
import { VestaboardClient } from '@/api/vestaboard';

describe('VestaboardClient', () => {
  describe('sendMessage', () => {
    it('should send message to Vestaboard API', async () => {
      // Arrange
      const client = new VestaboardClient({...});

      // Act
      const result = await client.sendMessage({...});

      // Assert
      expect(result).toBeDefined();
    });
  });
});
```

## Contributing

We welcome contributions! This project follows the SPICE development standards:

1. **Create a worktree** for your feature/fix

   ```bash
   mkdir -p trees
   git worktree add ./trees/feature-name -b feature/feature-name main
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

5. **Create a Pull Request**
   - Provide clear description of changes
   - Ensure all tests and linting pass
   - Include screenshots for UI changes

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
# Development
npm run dev                # Start development server with hot reload
npm run build              # Build for production
npm start                  # Run production build

# Testing
npm test                   # Run all tests
npm run test:unit          # Run unit tests only
npm run test:integration   # Run integration tests only
npm run test:e2e           # Run E2E tests only
npm run test:web           # Run web UI tests only
npm run test:all           # Run all tests with coverage
npm run test:watch         # Watch mode (re-run on changes)
npm run test:coverage      # Generate coverage report

# Code Quality
npm run lint               # Run linter
npm run lint:fix           # Run linter and auto-fix issues
npm run format             # Format code with Prettier
npm run typecheck          # Type check without building
```

## License

[License type to be determined]

## Author

Built with Claude Code

---

For more information, please contact [maintainer contact info]
