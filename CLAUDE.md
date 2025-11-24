# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clack Track creates engaging content for Vestaboard split-flap displays using AI-powered generation. The system operates with two distinct update modes:

**Major Updates** - Full content refreshes generating new quotes, news, weather, or custom content. Triggered by:

- Home Assistant events (e.g., person arrived home, door opened)
- Manual CLI commands
- Scheduled intervals (configurable)

**Minor Updates** - Every minute on the minute, updating only time and current weather while preserving the main content from the last major update.

**Web Interface** - Provides a debugging interface to view latest content, vote on quality (good/bad for AI training), and access debug logs.

**Tech Stack**: Node.js 20, TypeScript with ES modules (Node16 module resolution), TDD methodology with 80%+ test coverage requirements.

## Essential Commands

### Development

```bash
npm run dev           # Start development server with nodemon hot reload
npm run build         # Compile TypeScript to ./dist
npm start             # Run production build from ./dist/index.js
```

### Testing

```bash
npm test                   # Run all tests
npm run test:unit          # Unit tests only (tests/unit/**)
npm run test:integration   # Integration tests only (tests/integration/**)
npm run test:e2e           # End-to-end tests (tests/e2e/**) with 60s timeout
npm run test:web           # Web UI tests with jsdom environment
npm run test:all           # All tests with coverage report
npm run test:watch         # Watch mode for development
npm run test:coverage      # Generate detailed coverage report
```

**IMPORTANT**: All tests MUST be run from worktrees under `./trees/`, never from the root directory. The project enforces 80% coverage thresholds for branches, functions, lines, and statements.

### Code Quality

```bash
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix linting issues
npm run format        # Format with Prettier
npm run typecheck     # TypeScript type checking without building
```

**CRITICAL**: Always run `npm run lint:fix` before committing to prevent hook failures. Husky pre-commit hooks enforce linting and commitlint standards.

## Architecture Overview

### Core Component Flow

```
ContentGenerator → AI Providers → Formatters → VestaboardClient → Vestaboard Device
                ↗ Data Sources ↗
              ↗ PromptLoader ↗
```

### Key Architectural Layers

**1. API Layer** (`src/api/`)

- `vestaboard.ts` - VestaboardClient handles local API communication (HTTP to board)
- `ai/` - AI provider abstractions (OpenAI, Anthropic)
  - `openai.ts` - GPT model integration
  - `anthropic.ts` - Claude model integration
- `data-sources/` - External data integrations
  - `rss.ts` - RSS feed parsing for news
  - `rapidapi.ts` - RapidAPI service wrapper
  - `home-assistant.ts` - Home Assistant integration

**2. Content Layer** (`src/content/`)

- `generator.ts` - ContentGenerator orchestrates AI content creation
- `prompt-loader.ts` - Loads system/user prompts from `prompts/` directory
- `generators/` - Content generation strategies
  - `major-update.ts` - Full content refreshes (quotes, news, etc.)
  - `minor-update.ts` - Time/weather-only updates
- `formatters/` - Vestaboard layout formatting
  - `text-layout.ts` - Formats text for 6 rows × 22 chars display constraint

**3. Storage Layer** (`src/storage/`)

- `database.ts` - Database connection management
- `models/` - Data models (content, logs, votes)
- `repositories/` - Data access patterns (content-repo, vote-repo)

**4. Scheduler Layer** (`src/scheduler/`)

- `cron.ts` - CronScheduler for periodic content updates
- `event-handler.ts` - Event-driven update triggers

**5. Web Layer** (`src/web/`)

- `server.ts` - WebServer debugging interface (planned, not implemented)
- `routes/` - HTTP endpoints for content management, voting, logs
- `pages/` - Static HTML pages for debugging UI

**6. AI Provider Layer** (`src/api/ai/`)

- `openai.ts` - OpenAIClient implements AIProvider interface for GPT models
- `anthropic.ts` - AnthropicClient implements AIProvider interface for Claude models
- `index.ts` - Factory pattern (createAIProvider) for dependency injection
- Error types: `RateLimitError`, `AuthenticationError`, `InvalidRequestError`
- Connection validation: `validateConnection()` method tests API connectivity
- Token tracking: All responses include usage metrics

### Environment Configuration

Required variables in `.env`:

- `VESTABOARD_LOCAL_API_KEY` - From Vestaboard app Settings → Local API
- `VESTABOARD_LOCAL_API_URL` - Board IP (typically `http://192.168.1.x:7000`)
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` - AI provider credentials
- `UPDATE_INTERVAL` - Content refresh interval in minutes (default: 60)
- `DEFAULT_CONTENT_TYPE` - quote, weather, news, or custom

### AI Provider Configuration

- `AI_PROVIDER` - Select provider: `openai` or `anthropic`
- `OPENAI_API_KEY` - OpenAI API key (required if provider=openai)
- `ANTHROPIC_API_KEY` - Anthropic API key (required if provider=anthropic)
- `OPENAI_MODEL` - Override default GPT model (optional)
- `ANTHROPIC_MODEL` - Override default Claude model (optional)

Test connectivity: `npm run test:ai`

### Prompts System

The `prompts/` directory contains AI prompt templates:

- `system/` - Role and constraint definitions
  - `major-update-base.txt` - System prompt for full content updates
  - `minor-update-base.txt` - System prompt for time/weather updates
- `user/` - Content type specifications
  - `motivational.txt` - Quotes and inspiration
  - `news-summary.txt` - RSS feed summaries
  - `weather-focus.txt` - Weather-centric displays

Prompts are loaded via `PromptLoader` and combined into templates for AI providers.

### Module Resolution

- **Path Aliases**: `@/` maps to `src/`, `@tests/` maps to `tests/`
- **Module System**: ES modules with `.js` extensions in imports (TypeScript requirement)
- **Type Definitions**: Centralized in `src/types/` with `index.ts` aggregation

### Test Architecture

Four isolated test environments configured in `jest.config.cjs`:

1. **unit** - Node environment, mocks all externals
2. **integration** - Node environment, mocks only external APIs
3. **e2e** - Node environment, 60s timeout for full workflows
4. **web** - jsdom environment for DOM testing

All external dependencies (Vestaboard API, OpenAI, Anthropic) MUST be mocked in tests. Fixtures stored in `tests/fixtures/*.json`. Shared mocks in `tests/__mocks__/`.

## Development Workflow

### Git Worktree Pattern (Mandatory)

```bash
# Create worktree for feature (NOT Jira-based - this project doesn't use Jira)
mkdir -p trees
git worktree add ./trees/feature-name -b feature/feature-name main

# All development work happens in worktree
cd ./trees/feature-name
npm install  # Install dependencies in worktree

# Run tests from worktree
npm test

# After merge to main
git worktree remove ./trees/feature-name
git branch -d feature/feature-name
```

**CRITICAL**: LLMs must NEVER work in the root directory. All edits, tests, and builds occur in worktrees under `./trees/`.

### Commit Message Standards

Enforced by commitlint (husky pre-commit hook):

```
<type>(<scope>): <subject> (max 72 chars)

<body>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

**Note**: This project does NOT require Jira references in commits (unlike standard SPICE workflow).

## Important Constraints

### Vestaboard Display Limits

- 6 rows × 22 characters per row = 132 total characters
- Limited character set (uppercase letters, numbers, symbols)
- Content must be formatted by `text-layout.ts` before sending

### TypeScript Configuration

- Target: ES2022
- Module: Node16 (ES modules with `.js` imports)
- Strict mode enabled
- Output: `./dist` directory
- Source maps enabled for debugging

### Testing Requirements

- 80% minimum coverage (enforced by Jest)
- All external APIs mocked (no real HTTP calls)
- Tests isolated in `tests/` directory (excluded from build)
- Coverage reports in `coverage/` directory

## Common Development Tasks

### Adding a New Content Type

1. Create prompt in `prompts/user/<name>.txt`
2. Add enum value to `ContentType` in `src/types/index.ts`
3. Update `ContentGenerator` logic in `src/content/generator.ts`
4. Write tests in `tests/unit/content/` and `tests/integration/content-to-board/`

### Adding a New Data Source

1. Create client in `src/api/data-sources/<name>.ts`
2. Export from `src/api/data-sources/index.ts`
3. Add configuration to `.env.example`
4. Mock in `tests/__mocks__/` for testing

### Adding a New AI Provider

1. Implement client in `src/api/ai/<provider>.ts`
2. Export from `src/api/ai/index.ts`
3. Add API key to `.env.example`
4. Create mock responses in `tests/__mocks__/ai-providers.ts`

## Key Files to Reference

- **Entry point**: `src/index.ts` (minimal stub, calls `main()`)
- **Type definitions**: `src/types/index.ts` (central type exports)
- **Configuration**: `src/config/env.ts` (environment variable loading)
- **Test setup**: `tests/setup/jest.setup.ts` (global test configuration)
- **Commitlint config**: `commitlint.config.cjs` (commit message rules)
- **Jest config**: `jest.config.cjs` (multi-environment test setup)
- **AI Providers**: `src/api/ai/openai.ts`, `src/api/ai/anthropic.ts` (AI client implementations)
- **AI Factory**: `src/api/ai/index.ts` (createAIProvider factory function)
- **AI Mocks**: `tests/__mocks__/ai-providers.ts` (test mock factories)
- **AI Fixtures**: `tests/fixtures/openai-responses.json`, `tests/fixtures/anthropic-responses.json`
- **CLI Tools**: `src/cli/commands/test-ai.ts` (AI connectivity testing command)
