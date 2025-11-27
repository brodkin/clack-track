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
ContentOrchestrator → ContentSelector → ContentRegistry → Generators
     ↓                     ↓
generateWithRetry    P0→P2→P3 cascade
     ↓
FrameDecorator → VestaboardClient → Vestaboard Device

CronScheduler → EventHandler → ContentOrchestrator (scheduled updates)
```

### ContentOrchestrator Pipeline

Six-step pipeline for all content generation:

1. **Select** - ContentSelector picks generator via P0→P2→P3 priority cascade
2. **Generate** - `generateWithRetry()` with cross-provider failover
3. **Fallback** - P3 StaticFallbackGenerator on retry exhaustion
4. **Decorate** - FrameDecorator adds time/weather frame (if outputMode='text')
5. **Cache** - Store for minor updates
6. **Send** - VestaboardClient sends to device

**Cross-provider failover** triggers only on `RateLimitError` or `AuthenticationError`. Other errors skip directly to P3 fallback.

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

### Model Tier System

Three capability tiers for cost/performance optimization:

| Tier   | OpenAI      | Anthropic         | Use Case                 |
| ------ | ----------- | ----------------- | ------------------------ |
| LIGHT  | gpt-4o-mini | claude-3-haiku    | Fast, cheap (quotes)     |
| MEDIUM | gpt-4o      | claude-3-5-sonnet | Balanced (news, weather) |
| HEAVY  | gpt-4-turbo | claude-3-opus     | Complex reasoning        |

`ModelTierSelector` maintains capability level across provider failover.

### Content Generator Hierarchy

New generators must extend one of three abstract bases:

- **AIPromptGenerator** - AI-powered content. Implement `getSystemPromptFile()`, `getUserPromptFile()`
- **ProgrammaticGenerator** - Non-AI content. Implement `generate(context)`
- **NotificationGenerator** - P0 HA events. Implement `eventPattern` RegExp, `formatNotification()`

### Content Registry & Priority Selection

All generators registered via `ContentRegistry.register(metadata, generator)`. Selection uses P0→P2→P3 cascade:

- **P0 (NOTIFICATION)** - Event pattern matching for HA events (immediate, no frame)
- **P2 (NORMAL)** - Random selection from available generators
- **P3 (FALLBACK)** - Static fallback when all else fails

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

### Adding a New Content Generator

**For AI-powered content:**

1. Create prompt files in `prompts/system/` and `prompts/user/`
2. Extend `AIPromptGenerator` in `src/content/generators/ai/`
3. Register via `registerCoreContent()` in `src/content/registry/register-core.ts`
4. Write tests in `tests/unit/content/generators/`

**For programmatic content:**

1. Extend `ProgrammaticGenerator` in `src/content/generators/programmatic/`
2. Register with appropriate priority (P2 or P3)

**For HA event notifications:**

1. Extend `NotificationGenerator` with `eventPattern` RegExp
2. Register via `registerNotifications()` with P0 priority

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

## Critical Integration Patterns

### ColorBarService (Singleton - Performance Critical)

**MUST use `ColorBarService.getInstance()`** - never `new ColorBarService()`. Direct instantiation bypasses the 24-hour cache, causing ~2.4s AI API calls per frame instead of cache hits.

```typescript
// ✅ CORRECT
const service = ColorBarService.getInstance(aiProvider);

// ❌ WRONG - breaks cache, causes 2.4s delays
const service = new ColorBarService(aiProvider);
```

For test isolation: `ColorBarService.clearInstance()` before each test.

### Vestaboard Local API Quirks

1. **POST returns 201 with error body** - Must check response text for "invalid api key", not just HTTP status
2. **GET returns wrapped format** - Response is `{ message: [[...]] }`, not flat array

### CLI Boolean Flags

When adding CLI boolean flags, **MUST update `BOOLEAN_FLAGS` Set** in `src/cli/index.ts`:

```typescript
const BOOLEAN_FLAGS = new Set(['skip-weather', 'skip-colors', 'verbose', 'v']);
// ADD NEW BOOLEAN FLAGS HERE
```

Without this, positional arguments get incorrectly consumed as flag values.

### WebSocket Polyfill Import Order

In `src/api/data-sources/home-assistant.ts`, the WebSocket polyfill **MUST execute before** importing `home-assistant-js-websocket`:

```typescript
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;  // MUST be before HA imports
import { createConnection, ... } from 'home-assistant-js-websocket';
```

### Live Integration Tests

Vestaboard live tests require explicit opt-in: `VESTABOARD_LIVE_TEST=true`. Never enable in CI/CD without configuration.
