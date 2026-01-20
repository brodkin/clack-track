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
                    bootstrap()
                        ↓
    ┌───────────────────┼───────────────────┐
    ↓                   ↓                   ↓
EventHandler      CronScheduler      CLI Commands
(HA WebSocket)    (minute-aligned)   (generate, content:*)
    ↓                   ↓                   ↓
    └───────────────────┼───────────────────┘
                        ↓
              ContentOrchestrator
                        ↓
    ┌───────────────────┼───────────────────┐
    ↓                   ↓                   ↓
ContentSelector   generateWithRetry   FrameDecorator
(P0→P2→P3)       (cross-provider)    (time/weather)
    ↓                   ↓                   ↓
ContentRegistry   AI Providers        cachedContent
    ↓             (primary+alt)       (for minor updates)
Generators                                  ↓
                                    VestaboardClient
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

### Dual-Mode Update Pipeline

**Major Updates** (full regeneration):

- Triggered by: CLI `generate`, HA `content_trigger` events, `state_changed` P0 matches
- Pipeline: Full ContentOrchestrator flow (select → generate → decorate → cache → send)
- Side effect: Caches content in `orchestrator.cachedContent`

**Minor Updates** (frame refresh only):

- Triggered by: CronScheduler every 60 seconds (aligned to :00 seconds)
- Pipeline: MinorUpdateGenerator retrieves cache → reapplies frame → sends
- **Requires cached content** - throws error if no major update has run

```typescript
// Minor updates DEPEND on cached content from major updates
const cached = orchestrator.getCachedContent();
if (!cached) throw new Error('No cached content available');
```

### Layer Purposes

- **API Layer** - Vestaboard HTTP client, AI provider abstraction (factory pattern), data sources (RSS, RapidAPI, Home Assistant WebSocket)
- **Content Layer** - Generator orchestration, prompt loading from `prompts/`, text formatting for 6×22 character display
- **Storage Layer** - Database connection, models, repositories for content/votes/logs
- **Scheduler Layer** - Cron scheduling for periodic updates, event-driven update triggers
- **Web Layer** - Express server with security middleware (Helmet.js, rate limiting, compression, CORS)
- **Frontend Layer** - React SPA with Vite bundler, shadcn/ui components, React Router for navigation

### Web Frontend Architecture

The frontend is a React Single Page Application in `src/web/frontend/`:

```
src/web/frontend/
├── App.tsx              # Root with React Router
├── main.tsx             # Entry point with BrowserRouter
├── components/          # Reusable UI components
│   ├── ui/              # shadcn/ui components (Button, Card, Sheet, Badge...)
│   ├── Navigation.tsx   # Mobile hamburger + desktop nav bar
│   ├── PageLayout.tsx   # Wrapper with navigation
│   ├── VestaboardPreview.tsx  # 6×22 character grid display
│   ├── VotingButtons.tsx      # Thumbs up/down voting
│   └── ContentCard.tsx        # Content item with metadata badges
├── pages/               # Route components
│   ├── Welcome.tsx      # / - Latest content + voting
│   ├── History.tsx      # /flipside - Content history list
│   ├── Account.tsx      # /account - Profile + passkeys
│   └── Login.tsx        # /login - Passkey authentication
├── lib/
│   ├── mockData.ts      # Placeholder data for development
│   └── utils.ts         # cn() helper for Tailwind classes
└── services/
    └── apiClient.ts     # REST API wrapper
```

**Key Components:**

- `VestaboardPreview` - Renders 6×22 grid with split-flap aesthetic (amber text, black cells)
- `Navigation` - Responsive: Sheet-based hamburger on mobile, horizontal links on desktop
- `VotingButtons` - Touch-friendly (44px min) thumbs up/down for content quality voting

**Testing:** Frontend tests in `tests/web/` use jsdom environment with React Testing Library.

## Key Application Concepts

### Vestaboard Display Constraints

- 6 rows × 22 characters = 132 total characters
- Limited character set (uppercase letters, numbers, symbols)
- All content formatted via `text-layout.ts` before sending

### Vestaboard Hardware Models

**CRITICAL**: Vestaboard sells two physical models with different color behavior:

| Model               | Code 0 (blank) | Code 69    | Configuration            |
| ------------------- | -------------- | ---------- | ------------------------ |
| **Black** (default) | Shows BLACK    | WHITE tile | `VESTABOARD_MODEL=black` |
| **White**           | Shows WHITE    | BLACK tile | `VESTABOARD_MODEL=white` |

**Why this matters:**

- Code 0 (blank) shows the board's natural flap color - black on black boards, white on white boards
- Code 69 is a color tile that's swapped between models - WHITE on black boards, BLACK on white boards
- Sleep mode and other generators that need solid black backgrounds must use the correct code

**For white Vestaboard owners:**

```bash
# Add to .env
VESTABOARD_MODEL=white
```

**Implementation pattern:**

```typescript
import { getBlackCode } from '@/config/constants.js';
import { config } from '@/config/env.js';

// Returns code 0 for black boards, code 69 for white boards
const blackCode = getBlackCode(config.vestaboard?.model);
```

**Character codes reference:**

- 0 = blank (shows board's natural color)
- 1-26 = A-Z (amber letters)
- 27-36 = 0-9
- 37-62 = symbols
- 63-69 = color tiles (red, orange, yellow, green, blue, violet, white/black)
- 70 = explicit black tile (may not work on all firmware)
- 71 = filled (adaptive)

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

### Tool-Based Content Generation

All AI-powered generators use **tool-based generation** by default. Instead of accepting raw text responses, the AI must call the `submit_content` tool to submit content for server-side validation.

**How It Works:**

```
Generator → AI Provider → LLM calls submit_content tool
                              ↓
                    Server validates content
                              ↓
            ┌─────────────────┴─────────────────┐
            ↓                                   ↓
      Accepted → Return content           Rejected → Send feedback
                                                ↓
                                    LLM retries with improvements
                                          (max 3 attempts)
```

**Key Components:**

| Component             | Location                                         | Purpose                                 |
| --------------------- | ------------------------------------------------ | --------------------------------------- |
| `ToolBasedGenerator`  | `src/content/generators/tool-based-generator.ts` | Wrapper that manages tool call loop     |
| `submit_content` tool | `src/content/tools/submit-content.ts`            | Tool definition and validation executor |
| `PreviewRenderer`     | `src/content/tools/preview-renderer.ts`          | ASCII preview for validation feedback   |

**Validation Rules (Framed Content):**

- Maximum 5 rows (row 6 reserved for info bar)
- Maximum 21 characters per row (1 column reserved for frame padding)
- Only Vestaboard-supported characters (uppercase letters, numbers, symbols)
- Explicit newlines preserved (content displayed as validated)

**Exhaustion Strategies** (when max attempts reached):

| Strategy          | Behavior                                     |
| ----------------- | -------------------------------------------- |
| `throw` (default) | Throw error, trigger P3 fallback             |
| `use-last`        | Force-accept last submission with truncation |

**Configuring Tool-Based Options** (via ContentRegistration):

```typescript
// Configure tool-based generation options in generator registration
ContentRegistry.getInstance().register(
  {
    id: 'custom-generator',
    name: 'Custom Generator',
    priority: ContentPriority.NORMAL,
    modelTier: ModelTier.LIGHT,
    toolBasedOptions: {
      maxAttempts: 5, // Default: 3
      exhaustionStrategy: 'use-last', // Default: 'throw'
    },
  },
  customGenerator
);
```

**Why Tool-Based Generation:**

1. **Validation before acceptance** - Content validated server-side before being accepted
2. **Iterative refinement** - LLM can fix errors based on validation feedback
3. **Consistent formatting** - Ensures content fits display constraints
4. **Better error messages** - LLM sees exactly what went wrong (too long, invalid chars, etc.)

### Model Tier System

Three capability tiers for cost/performance optimization:

| Tier   | OpenAI       | Anthropic         | Use Case                 |
| ------ | ------------ | ----------------- | ------------------------ |
| LIGHT  | gpt-4.1-nano | claude-haiku-4.5  | Fast, cheap (quotes)     |
| MEDIUM | gpt-4.1-mini | claude-sonnet-4.5 | Balanced (news, weather) |
| HEAVY  | gpt-4.1      | claude-opus-4.5   | Complex reasoning        |

`ModelTierSelector` maintains capability level across provider failover.

### Content Generator Hierarchy

New generators must extend one of three abstract bases:

- **AIPromptGenerator** - AI-powered content. Implement `getSystemPromptFile()`, `getUserPromptFile()`
- **ProgrammaticGenerator** - Non-AI content. Implement `generate(context)`
- **NotificationGenerator** - P0 HA events. Implement `eventPattern` RegExp, `formatNotification()`

### Generator Data Architecture

**Principle: Generators are responsible for their own data needs.**

| Layer         | Contains                                                    | Mechanism                                         |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| System Prompt | Universal context (date, personality, persona, constraints) | Template variables `{{var}}` in `prompts/system/` |
| User Prompt   | Content-specific instructions                               | Plain text in `prompts/user/`                     |
| Generator     | Data fetching for content-specific needs                    | Override methods, inject via template variables   |

**Rules:**

1. **Self-Sufficient** - Each generator fetches only the data it needs. The base class does NOT inject data that may be unused.
2. **Template Variables** - Data flows into prompts via `{{placeholder}}` syntax, resolved by `PromptLoader.loadPromptWithVariables()`.
3. **No Wasteful Injection** - A motivational generator should NOT receive weather data. A weather generator fetches its own weather.

**Example - Weather Generator needs weather:**

```
WeatherGenerator → fetches weather → passes to template vars → {{temperature}} in prompt
```

**Example - Motivational Generator does NOT need weather:**

```
MotivationalGenerator → no weather fetch → clean prompt with just universal context
```

**Universal context** (date, time, personality) is already in the system prompt via template variables. Content-specific data (weather, news, etc.) must be fetched by generators that need it.

### Content Registry & Priority Selection

All generators registered via `ContentRegistry.register(metadata, generator)`. Selection uses P0→P2→P3 cascade:

- **P0 (NOTIFICATION)** - Event pattern matching for HA events (immediate, no frame)
- **P2 (NORMAL)** - Random selection from available generators
- **P3 (FALLBACK)** - Static fallback when all else fails

### Sleep Mode System

Sleep mode is a special display mode that shows a dark starfield art pattern with an AI-generated bedtime greeting.

**User Commands:**

```bash
# Enter sleep mode (display goodnight art, block updates)
npm run circuit:on -- SLEEP_MODE

# Exit sleep mode (display good morning, resume normal updates)
npm run circuit:off -- SLEEP_MODE
```

**Architecture (Composite Generator):**

```
SleepModeGenerator
├── SleepArtGenerator (programmatic) → generates 6x22 starfield pattern
└── SleepGreetingGenerator (AI) → generates bedtime text
    ↓
Overlay text on art → combined characterCodes layout
```

**Convention Breaks:**

| Standard Convention                       | Sleep Mode Behavior                                |
| ----------------------------------------- | -------------------------------------------------- |
| Frame decoration (time/weather)           | **No frame** - full 6x22 art display               |
| `outputMode: 'text'` with text processing | **`outputMode: 'layout'`** with raw characterCodes |
| P2 random selection                       | **P0 priority** - bypasses normal selection        |
| Single generator                          | **Composite** - combines art + text generators     |

**Implementation Note:** Internally, sleep mode uses the circuit breaker's blocking state (`state='off'`) to prevent updates while sleeping. The CLI commands map user intent (`on` = enter sleep, `off` = wake up) to the appropriate internal state.

**Text Overlay Behavior:**

- Text centered vertically and horizontally
- Spaces are **transparent** (preserve underlying art pattern)
- Letters use actual character codes (1-26) displayed in amber
- Unsupported characters become black (blend with background)

**Key Files:**

- `src/content/generators/programmatic/sleep-mode-generator.ts` - Composite generator
- `src/content/generators/programmatic/sleep-art-generator.ts` - Starfield pattern
- `src/content/generators/ai/sleep-greeting-generator.ts` - AI bedtime text
- `src/cli/commands/circuit.ts` - `enterSleepMode()` and `exitSleepMode()` functions

### Home Assistant Integration

WebSocket client for event-driven content updates. Supports:

- Event subscriptions with multiple subscribers per event type
- State queries with optional TTL-based caching
- Service calls to control HA devices/automations
- Automatic reconnection with exponential backoff
- Connection validation with latency measurement

**Dual-Subscription Pattern**: EventHandler subscribes to TWO event types:

1. `vestaboard_refresh` - Custom event for explicit update triggers → P2 major updates
2. `state_changed` - Entity changes matched against trigger configuration → major updates

**Trigger Configuration System** (`TRIGGER_CONFIG_PATH`):

When `TRIGGER_CONFIG_PATH` is set, the system loads a YAML configuration file defining which entity state changes trigger Vestaboard updates:

```yaml
# config/triggers.yaml
triggers:
  - name: 'Person Arrival'
    entity_pattern: 'person.*' # Glob pattern
    state_filter: 'home' # Only trigger on "home" state
    debounce_seconds: 60 # Prevent rapid re-triggers
```

**Key Components:**

- `TriggerConfigLoader` (`src/config/trigger-config.ts`) - YAML loading with hot-reload via chokidar
- `TriggerMatcher` (`src/scheduler/trigger-matcher.ts`) - Pattern matching (exact, glob, regex) with per-trigger debouncing
- `EventHandler` - Integrates TriggerMatcher for state_changed event processing

**Pattern Types:**

- Exact: `"binary_sensor.front_door"`
- Glob: `"person.*"`, `"sensor.*_temperature"` (uses minimatch)
- Regex: `"/^cover\\..*garage.*$/i"` (JavaScript regex syntax)

**Flow:**

```
state_changed event → EventHandler → TriggerMatcher.match(entityId, newState)
                                          ↓
                        pattern match + state filter + debounce check
                                          ↓
                        (match && !debounced) → orchestrator.generateAndSend()
```

**Conditional Initialization**: EventHandler only created if HA is configured. TriggerMatcher only injected if `TRIGGER_CONFIG_PATH` is set:

```typescript
const { eventHandler } = await bootstrap();
if (eventHandler) {
  await eventHandler.initialize();
}
```

**For detailed API documentation**, see `src/api/data-sources/CLAUDE.md` (loaded on-demand when working with HA integration).
**For user setup guide**, see `docs/HOME_ASSISTANT_SETUP.md` (includes Trigger Configuration section).

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
| Production access | `.env.production` (contains `DOCKER_HOST` for inspecting prod containers)         |
| TypeScript config | `tsconfig.json`                                                                   |
| Test config       | `jest.config.cjs`                                                                 |
| Commit rules      | `commitlint.config.cjs`                                                           |
| HA API docs       | `src/api/data-sources/CLAUDE.md`                                                  |
| HA setup guide    | `docs/HOME_ASSISTANT_SETUP.md`                                                    |
| Trigger config    | `config/triggers.example.yaml`                                                    |
| AI fixtures       | `tests/fixtures/openai-responses.json`, `tests/fixtures/anthropic-responses.json` |
| Test mocks        | `tests/__mocks__/`                                                                |

## Critical Integration Patterns

### Bootstrap Pattern (Required for CLI Commands)

All CLI commands MUST call `bootstrap()` in `src/bootstrap.ts` to initialize dependencies and populate ContentRegistry:

```typescript
export async function myCommand(): Promise<void> {
  const { orchestrator, scheduler, registry, eventHandler } = await bootstrap();

  try {
    // Use injected components
    await orchestrator.generateAndSend({ updateType: 'major', timestamp: new Date() });
  } finally {
    scheduler.stop(); // CRITICAL: Clean shutdown to prevent dangling timers
  }
}
```

**Bootstrap Returns:**

- `orchestrator` - ContentOrchestrator for generation
- `eventHandler` - EventHandler (`null` if HA not configured)
- `scheduler` - CronScheduler (always present, must be stopped)
- `registry` - ContentRegistry (populated with all generators)

**Why This Matters:**

- ContentRegistry is a singleton populated during bootstrap
- Without bootstrap, registry is empty and generators are not registered
- Forgetting `scheduler.stop()` causes test hangs and resource leaks

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

### CLI Commands

**Available Commands:**

```bash
npm run generate              # Generate and send major content update
npm run generate -- --generator <id>  # Generate using specific generator
npm run test-board            # Test Vestaboard connection
npm run test-ai               # Test AI provider connectivity
npm run test-ha               # Test Home Assistant connectivity
npm run frame [text]          # Generate and preview Vestaboard frame
npm run content:list          # List all registered generators by priority
npm run content:test <id>     # Test specific generator (dry-run, no send)
npm run content:test <id> --with-frame  # Test with frame decoration
```

### CLI Boolean Flags

When adding CLI boolean flags, **MUST update `BOOLEAN_FLAGS` Set** in `src/cli/index.ts`:

```typescript
const BOOLEAN_FLAGS = new Set([
  'skip-weather',
  'skip-colors',
  'verbose',
  'v',
  'interactive',
  'list',
  'with-frame',
]);
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
