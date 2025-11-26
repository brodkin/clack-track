# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Clack Track creates AI-powered content for Vestaboard split-flap displays. The system operates with two distinct update modes:

**Major Updates** - Full content refreshes generating new quotes, news, weather, or custom content. Triggered by:

- Home Assistant events (e.g., person arrived home, door opened)
- Manual CLI commands
- Scheduled intervals (configurable)

**Minor Updates** - Every minute on the minute, updating only time and current weather while preserving the main content from the last major update.

**Web Interface** - Provides a debugging interface to view latest content, vote on quality (good/bad for AI training), and access debug logs.

**Headless Mode** - Set `WEB_SERVER_ENABLED=false` to run CLI commands without web server (useful for testing, CI/CD, Docker containers).

**Tech Stack**: Node.js 20, TypeScript with ES modules (Node16 module resolution), TDD methodology with 80%+ test coverage requirements.

**Note:** This project uses Beads for issue tracking, not Jira.

## Architecture Overview

### Core Component Flow

```
EventHandler ← HomeAssistantClient (WebSocket)
     ↓
ContentGenerator → AI Providers → Formatters → VestaboardClient → Vestaboard Device
                ↗ Data Sources ↗
              ↗ PromptLoader ↗

CronScheduler → EventHandler → ContentGenerator (scheduled updates)
```

### Layer Purposes

- **API Layer** - Vestaboard HTTP client, AI provider abstraction (factory pattern), data sources (RSS, RapidAPI, Home Assistant WebSocket)
- **Content Layer** - Generator orchestration, prompt loading from `prompts/`, text formatting for 6×22 character display
- **Storage Layer** - Database connection, models, repositories for content/votes/logs
- **Scheduler Layer** - Cron scheduling for periodic updates, event-driven update triggers
- **Web Layer** - Express server with security middleware (Helmet.js, rate limiting, compression, CORS)

## Key Application Concepts

### Vestaboard Display Constraints

- 6 rows × 22 characters = 132 total characters
- Limited character set (uppercase letters, numbers, symbols)
- All content formatted via `text-layout.ts` before sending

### Prompts System

- `prompts/system/` - Role and constraint definitions (major/minor update base prompts)
- `prompts/user/` - Content type specifications (motivational, news-summary, weather-focus)
- Loaded by `PromptLoader`, combined into templates for AI providers

### AI Provider Abstraction

- Factory pattern: `createAIProvider()` in `src/api/ai/index.ts`
- Implementations: `OpenAIClient` (GPT models), `AnthropicClient` (Claude models)
- Common interface: `generate()` method and `validateConnection()`
- Config-driven selection via `AI_PROVIDER` environment variable
- Error types: `RateLimitError`, `AuthenticationError`, `InvalidRequestError`

### Home Assistant Integration

WebSocket client for event-driven content updates. Supports:

- Event subscriptions with multiple subscribers per event type
- State queries with optional TTL-based caching
- Service calls to control HA devices/automations
- Automatic reconnection with exponential backoff
- Connection validation with latency measurement

**For detailed API documentation**, see `src/api/data-sources/CLAUDE.md` (loaded on-demand when working with HA integration).

### Security Features

- **Helmet.js** - Security headers (CSP, X-Frame-Options, HSTS, etc.)
- **Rate Limiting** - 100 requests per 15 minutes on `/api/*` routes
  - Configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`
  - Returns 429 status with `RateLimit-*` headers
- **Middleware Order** - Helmet → Compression → CORS → Rate Limit → Static → JSON → Routes

### Module Resolution

- Path aliases: `@/` → `src/`, `@tests/` → `tests/`
- ES modules with `.js` extensions in imports (TypeScript requirement)
- Type definitions: Centralized in `src/types/` with `index.ts` aggregation

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

1. Implement `AIProvider` interface in `src/api/ai/<provider>.ts`
2. Export from `src/api/ai/index.ts`
3. Add API key to `.env.example`
4. Create mock responses in `tests/__mocks__/ai-providers.ts`

## Important Constraints

### Testing Requirements

- 80% minimum coverage enforced by Jest (branches, functions, lines, statements)
- All external APIs mocked (no real HTTP calls)
- Four isolated test environments: unit, integration, e2e (60s timeout), web (jsdom)
- Tests MUST run in worktrees under `./trees/`, never from root directory
- Coverage reports in `coverage/` directory

### TypeScript Configuration

- Target: ES2022, Module: Node16 (ES modules)
- Strict mode enabled, output: `./dist`
- Source maps enabled for debugging

## Quick Reference

| Need              | Source                                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| npm scripts       | `npm run` or `package.json`                                                       |
| Environment vars  | `.env.example`                                                                    |
| TypeScript config | `tsconfig.json`                                                                   |
| Test config       | `jest.config.cjs`                                                                 |
| Commit rules      | `commitlint.config.cjs`                                                           |
| HA API docs       | `src/api/data-sources/CLAUDE.md`                                                  |
| AI fixtures       | `tests/fixtures/openai-responses.json`, `tests/fixtures/anthropic-responses.json` |
| Test mocks        | `tests/__mocks__/`                                                                |
