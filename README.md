# Clack Track

> A Node.js application that updates Vestaboards over their local API with AI-generated content

## Overview

Clack Track is a smart display manager for Vestaboard split-flap displays that creates engaging, AI-powered content and displays it via the Vestaboard local API. The system intelligently manages content updates through two modes:

- **Major Updates**: Full content refreshes triggered by Home Assistant `vestaboard_refresh` events or manual CLI commands, generating fresh quotes, news, weather, and custom content
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
- 📱 **Progressive Web App** - Installable, offline-capable, with push notifications
- 🛡️ **Rate Limiting** - API rate limiting (100 req/15min) with configurable thresholds
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
- **Home Assistant API** - Weather data and event-driven refresh triggers

### Home Assistant Integration

Clack Track integrates with Home Assistant to trigger content refreshes based on smart home events.

#### Triggering a Refresh

Fire the `vestaboard_refresh` custom event from any Home Assistant automation to trigger a major content update:

**Example Automation (YAML):**

```yaml
automation:
  - alias: 'Refresh Vestaboard on Person Arrival'
    trigger:
      - platform: state
        entity_id: person.john
        to: 'home'
    action:
      - event: vestaboard_refresh
        event_data:
          trigger: 'person_arrived'
          person: '{{ trigger.to_state.name }}'

  - alias: 'Refresh Vestaboard Every 30 Minutes'
    trigger:
      - platform: time_pattern
        minutes: '/30'
    action:
      - event: vestaboard_refresh
        event_data:
          trigger: 'scheduled'
```

**Example Service Call:**

```yaml
service: homeassistant.fire_event
data:
  event_type: vestaboard_refresh
  event_data:
    trigger: 'manual'
```

#### Event Data

The `event_data` is optional and passed to the content orchestrator. You can include any metadata useful for debugging or future content customization.

#### Configuration

Set up Home Assistant connection in your `.env` file:

```bash
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=your-long-lived-access-token
```

To create a long-lived access token:

1. Open Home Assistant
2. Click your profile (bottom left)
3. Scroll to "Long-Lived Access Tokens"
4. Create a new token and copy it to your `.env`

### Update Mechanism

The system operates in two distinct modes:

#### Major Updates

Triggered by:

- Home Assistant `vestaboard_refresh` custom event (see [Home Assistant Integration](#home-assistant-integration))
- Manual CLI commands (`npm run generate`)
- On daemon startup (initial content)

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

#### Web Server Configuration

The web server can be enabled or disabled via environment variable:

```bash
# Enable web server (default)
WEB_SERVER_ENABLED=true

# Disable web server (headless mode)
WEB_SERVER_ENABLED=false
```

**Headless Mode** is useful for:

- CLI-only usage (`npm run generate`, `npm run content:test`)
- Testing environments
- Docker containers without web UI requirements
- Resource-constrained deployments

#### Frontend Architecture

The web frontend is built with:

- **React 18** with TypeScript
- **React Router** for client-side routing
- **Tailwind CSS v4** for styling
- **shadcn/ui** component library
- **Vite** for development and bundling

**Routes:**

- `/` - Welcome page with Vestaboard preview and voting
- `/flipside` - Content history with metadata and voting
- `/account` - User profile and passkey management
- `/login` - Passkey-only authentication

### Progressive Web App (PWA)

Clack Track includes PWA support for an enhanced mobile experience:

- **Installable** - Add to home screen on iOS/Android for native-like access
- **Offline Support** - Service worker caches assets for offline viewing
- **Push Notifications** - Receive alerts when new content is generated (optional)

#### PWA Setup

The PWA is built using [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) with Workbox for service worker generation.

**Prerequisites:**

- PWA icons in `public/` directory:
  - `pwa-192x192.png` - Standard PWA icon
  - `pwa-512x512.png` - Large icon (also used as maskable icon)
  - `apple-touch-icon.png` - iOS home screen icon

> **Note:** PWA icons are not yet created. See issue `clack-37ai` for icon creation task.

#### Service Worker Caching Strategies

The service worker uses different caching strategies for different content types:

| Content Type                           | Strategy     | Cache Duration   |
| -------------------------------------- | ------------ | ---------------- |
| API requests (`/api/*`)                | NetworkFirst | 5 minutes        |
| Images (`.png`, `.jpg`, etc.)          | CacheFirst   | 30 days          |
| Google Fonts                           | CacheFirst   | 1 year           |
| Static assets (`.js`, `.css`, `.html`) | Precache     | Until next build |

#### Push Notification Setup (Optional)

Push notifications require VAPID (Voluntary Application Server Identification) keys for secure server-to-client messaging.

**1. Generate VAPID Keys:**

```bash
npx web-push generate-vapid-keys
```

This outputs a public key and private key pair. Keep the private key secret!

**2. Configure Environment Variables:**

```bash
# Add to .env file
VAPID_PUBLIC_KEY=BIxaHtm...your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:your-email@example.com
```

| Variable            | Description                                      |
| ------------------- | ------------------------------------------------ |
| `VAPID_PUBLIC_KEY`  | Base64-encoded public key (shared with frontend) |
| `VAPID_PRIVATE_KEY` | Base64-encoded private key (server-side only)    |
| `VAPID_SUBJECT`     | Contact email as `mailto:` URI                   |

**3. Push Notification API Endpoints:**

| Method | Endpoint                     | Description                                  |
| ------ | ---------------------------- | -------------------------------------------- |
| GET    | `/api/push/vapid-public-key` | Get VAPID public key for client subscription |
| POST   | `/api/push/subscribe`        | Store a push subscription                    |
| DELETE | `/api/push/unsubscribe`      | Remove a push subscription                   |
| POST   | `/api/push/test`             | Send test notification (dev only)            |

#### Testing PWA Installation

**iOS (Safari):**

1. Open Clack Track in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Name the app and tap "Add"

**Android (Chrome):**

1. Open Clack Track in Chrome
2. Tap the three-dot menu
3. Select "Install app" or "Add to Home Screen"
4. Confirm installation

**Desktop (Chrome/Edge):**

1. Look for the install icon in the address bar
2. Click "Install"

### API Rate Limiting

The web API is protected with rate limiting to prevent abuse and ensure fair usage:

- **Default Policy**: 100 requests per 15 minutes per IP address
- **Scope**: Applied to all `/api/*` routes
- **Response**: Returns `429 Too Many Requests` when limit exceeded
- **Headers**: Includes `Retry-After` header indicating when to retry
- **Configuration**: Customizable via environment variables

#### Rate Limit Configuration

Configure rate limits in your `.env` file:

```bash
# Rate limiting (optional)
RATE_LIMIT_WINDOW_MS=900000      # Time window in milliseconds (default: 15 minutes)
RATE_LIMIT_MAX_REQUESTS=100       # Maximum requests per window (default: 100)
```

#### Rate Limit Response Format

When rate limit is exceeded, the API returns:

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 897
Content-Type: application/json

{
  "error": "Too many requests from this IP, please try again later"
}
```

The `Retry-After` header indicates seconds until the rate limit window resets.

### REST API Endpoints

The web server exposes the following REST API endpoints:

#### Content Endpoints

| Method | Endpoint                        | Description                                    |
| ------ | ------------------------------- | ---------------------------------------------- |
| GET    | `/api/content/latest`           | Get the most recent content sent to Vestaboard |
| GET    | `/api/content/history?limit=20` | Get paginated content history                  |

**GET /api/content/latest**

```json
// Response 200 OK
{
  "success": true,
  "data": {
    "id": 1,
    "text": "HELLO WORLD",
    "characterCodes": [[8,5,12,12,15], ...],
    "generatorId": "motivational",
    "modelTier": "LIGHT",
    "metadata": { "provider": "openai", "tokens": 150 },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}

// Response 404 Not Found
{ "success": false, "error": "No content found" }
```

**GET /api/content/history?limit=20**

```json
// Response 200 OK
{
  "success": true,
  "data": [
    /* array of content records */
  ],
  "pagination": { "limit": 20, "count": 15 }
}
```

#### Voting Endpoints

| Method | Endpoint          | Description                       |
| ------ | ----------------- | --------------------------------- |
| POST   | `/api/vote`       | Submit a quality vote for content |
| GET    | `/api/vote/stats` | Get aggregated voting statistics  |

**POST /api/vote**

```json
// Request
{ "contentId": 1, "vote": "good" }  // vote: "good" | "bad"

// Response 200 OK
{
  "success": true,
  "data": { "id": 1, "contentId": 1, "vote": "good", "createdAt": "..." }
}

// Response 400 Bad Request
{ "success": false, "error": "contentId and vote are required" }
{ "success": false, "error": "vote must be \"good\" or \"bad\"" }
```

**GET /api/vote/stats**

```json
// Response 200 OK
{
  "success": true,
  "data": { "totalVotes": 100, "goodVotes": 75, "badVotes": 25 }
}
```

#### Logs Endpoints

| Method | Endpoint                         | Description           |
| ------ | -------------------------------- | --------------------- |
| GET    | `/api/logs?level=info&limit=100` | Get recent debug logs |
| DELETE | `/api/logs?days=30`              | Clear old debug logs  |

**GET /api/logs?level=info&limit=100**

```json
// Response 200 OK
{
  "success": true,
  "data": [{ "id": 1, "level": "info", "message": "...", "timestamp": "..." }],
  "count": 50
}
```

- `level`: Filter by log level (`info`, `warn`, `error`, `debug`)
- `limit`: Max records to return (default: 100, max: 500)

**DELETE /api/logs?days=30**

```json
// Response 200 OK
{
  "success": true,
  "message": "Logs cleared successfully",
  "deletedCount": 150
}
```

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

Clack Track supports multiple AI providers for content generation. Configure your preferred provider in `.env`:

**OpenAI Setup:**

1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Generate an API key at https://platform.openai.com/api-keys
3. Add to `.env`:
   ```
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   ```
4. Test connectivity: `npm run test:ai:openai`

**Anthropic Setup:**

1. Sign up at [Anthropic Console](https://console.anthropic.com/)
2. Generate an API key at https://console.anthropic.com/settings/keys
3. Add to `.env`:
   ```
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Test connectivity: `npm run test:ai:anthropic`

**Testing Your Setup:**

```bash
# Test all configured providers
npm run test:ai

# Test specific provider
npm run test:ai:openai
npm run test:ai:anthropic
```

For detailed usage examples, see [AI Provider Usage Guide](docs/ai-providers.md).

**Troubleshooting:**

- **"API key is required"**: Verify API key is set in `.env` and matches your provider selection
- **Rate limit errors**: Wait 60 seconds between requests or upgrade your account tier
- **Authentication failures**: Check that your API key is valid and has available credits

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
│   ├── web/            # Web server and frontend
│   │   ├── routes/     # REST API endpoints (content, voting, logs)
│   │   ├── middleware/ # Rate limiting, auth, etc.
│   │   └── frontend/   # React SPA
│   │       ├── components/  # UI components (VestaboardPreview, Navigation, etc.)
│   │       ├── pages/       # Page components (Welcome, History, Account, Login)
│   │       └── lib/         # Utilities, mock data, API client
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

# Content Management Commands
npm run content:list           # List all registered content generators
npm run content:test <id>      # Test a specific generator (dry-run, no send)
npm run content:test <id> --with-frame  # Test with frame decoration

# Diagnostics
npm run test-board             # Test Vestaboard connection
npm run test-ai                # Test AI provider connectivity
npm run test-ha                # Test Home Assistant connectivity
npm run frame "Your text"      # Preview Vestaboard frame formatting
```

## Development Scripts

```bash
# Development
npm run dev                # Start development server with hot reload
npm run dev:web            # Start frontend dev server only (Vite HMR)
npm run build              # Build for production (backend + frontend)
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
