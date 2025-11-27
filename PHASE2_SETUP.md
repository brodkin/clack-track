# Phase 2: News Generators Implementation - Setup Complete

**Timestamp**: 2025-11-27T10:45:00Z  
**Worktree**: `/workspace/trees/clack-viu-news`  
**Branch**: `feature/clack-viu-news`  
**Base**: `feature/clack-viu-review` (contains Phase 1 foundation)

## Setup Summary

Phase 2 worktree has been successfully created and configured for news generators implementation. The environment includes:

### Environment Status

- ✅ Worktree created at `/workspace/trees/clack-viu-news`
- ✅ Feature branch `feature/clack-viu-news` created from Phase 1 foundation
- ✅ 853 npm packages installed (0 vulnerabilities)
- ✅ TypeScript compilation passing
- ✅ Client build (Vite) successful (117 KB gzipped)
- ✅ ESLint checks passing
- ✅ Git repository clean and ready

### Phase 1 Foundation Available

The Phase 1 foundation is already in place (merged into feature/clack-viu-review):

**Base Classes:**

- `AIPromptGenerator` - Base class for AI-powered generators
- `NotificationGenerator` - Base class for Home Assistant event notifications
- `ProgrammaticGenerator` - Base class for programmatic content

**News Foundation (already created):**

- `src/content/generators/ai/base-news-generator.ts` - NewsGenerator base class
- `src/content/generators/ai/news-generator.ts` - Concrete news generator implementation
- `prompts/user/news-summary.txt` - News summary prompt
- `prompts/user/test-news-prompt.txt` - Test news prompt

**Test Coverage:**

- `tests/unit/content/generators/ai/base-news-generator.test.ts`
- `tests/unit/content/generators/ai/news-generator.test.ts`

## Phase 2 Implementation Plan

### News Generators to Implement

1. **HackerNews Generator** - Top stories from Hacker News
   - Use `AIPromptGenerator` base class
   - Fetch data via Hacker News API
   - Generate compelling summaries for 6x22 display
   - System prompt: "You are a tech news curator"
   - User prompt: Focus on trending tech topics

2. **BBC News Generator** - Breaking news summaries
   - Use `AIPromptGenerator` base class
   - Fetch data via BBC News API or RSS feed
   - Create timely news updates
   - System prompt: "You are a news editor"
   - User prompt: Summarize top stories concisely

3. **Weather-Enhanced News** - Weather + relevant news
   - Use `AIPromptGenerator` base class
   - Combine weather data with contextual news
   - System prompt: "You are a weather-aware news provider"
   - User prompt: Pick news relevant to current weather

### Implementation Steps

#### 1. Create Generators (src/content/generators/ai/)

- Extend `AIPromptGenerator`
- Implement `getSystemPromptFile()` and `getUserPromptFile()`
- Handle API data fetching in `generate()` method
- Return formatted content for 6x22 display

#### 2. Add Prompt Files (prompts/)

- `prompts/system/news-curator-system.txt` - Hacker News system prompt
- `prompts/user/hacker-news.txt` - Hacker News user prompt
- `prompts/system/bbc-editor-system.txt` - BBC News system prompt
- `prompts/user/bbc-news.txt` - BBC News user prompt
- `prompts/system/weather-news-system.txt` - Weather news system prompt
- `prompts/user/weather-news.txt` - Weather news user prompt

#### 3. Data Source Integration

- Create Hacker News API client in `src/api/data-sources/`
- Use existing RSS/API clients for BBC News
- Leverage weather data from existing sources

#### 4. Register Generators

- Add registrations in `src/content/registry/register-core.ts`
- Set appropriate priorities (P2 for general, P0 for urgent news)

#### 5. Write Tests

- Create comprehensive unit tests: `tests/unit/content/generators/ai/[generator-name].test.ts`
- Mock all external API calls
- Target 80%+ coverage for new code
- Test error handling and fallback scenarios

#### 6. Validation Commands

```bash
# Test build
npm run build

# Run tests (ensure 80%+ coverage)
npm run test

# Test individual generator
npm run content:test [generator-id]

# Test with frame decoration
npm run content:test [generator-id] --with-frame
```

## Development Environment

### Available Commands

```bash
npm run build          # Compile TypeScript and build client
npm run dev           # Start development server (watches for changes)
npm run test          # Run full test suite
npm run test -- --coverage  # Run with coverage analysis
npm run lint          # Check code quality
npm run lint:fix      # Auto-fix linting issues
npm run generate      # Manual major update
npm run frame [text]  # Preview frame rendering
npm run content:list  # List all registered generators
npm run content:test [id]  # Test specific generator
```

### Code Quality Requirements

- **Test Coverage**: 80%+ minimum (enforced by Jest)
- **Linting**: ESLint must pass before commit (Husky hook)
- **TypeScript**: Strict mode, no implicit any
- **Module Resolution**: Path aliases (@/, @tests/) configured

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

Ref: clack-viu
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Example:

```
feat(content): add Hacker News generator

Implements AIPromptGenerator for fetching and summarizing top tech stories.
Includes data source integration and comprehensive unit tests.

Ref: clack-viu
```

## Integration Checklist

- [ ] Create Hacker News API client
- [ ] Create Hacker News generator with tests
- [ ] Create BBC News API client
- [ ] Create BBC News generator with tests
- [ ] Create Weather-Enhanced News generator with tests
- [ ] Add all prompt files
- [ ] Register all generators in registry
- [ ] Run full test suite (verify 80%+ coverage)
- [ ] Run linting (npm run lint)
- [ ] Manual testing with content:test command
- [ ] Ready for merge to feature/clack-viu-review

## Next Steps

1. Start with Hacker News generator (simplest API integration)
2. Create API client to fetch top 30 stories
3. Implement generator to select and summarize top 5
4. Add comprehensive tests with mocked API responses
5. Validate with `npm run content:test hacker-news --with-frame`
6. Repeat for BBC News and Weather-Enhanced News
7. Merge to develop when all tests pass and coverage is 80%+

---

**Status**: Ready for Phase 2 Implementation  
**Ready To Start**: Yes - All environment validations passed
