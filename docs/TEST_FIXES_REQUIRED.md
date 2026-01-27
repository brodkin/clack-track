# Test Suite Standards Compliance Review

This document catalogs all test files requiring fixes to meet the project's testing standards as defined in `CLAUDE.md`.

## Executive Summary

| Metric | Value |
|--------|-------|
| Total test files reviewed | 163 |
| Files passing standards | ~27 (17%) |
| Files requiring fixes | ~136 (83%) |
| Critical issues (misclassified tests) | 80+ files |
| High priority issues (anti-patterns) | 50+ files |

## Testing Standards Reference

### When to Use Each Test Type

| Test Type | Use For | Skip For |
|-----------|---------|----------|
| **Unit** | Pure functions, math, formatting, parsing (deterministic input→output) | Orchestration, workflows, anything requiring mocks |
| **Integration** | Feature behavior, component interactions, database ops, API handlers | Library behavior, implementation details |
| **E2E** | Critical user journeys (auth, content pipeline, web UI) | Features covered by integration tests |

### Anti-Patterns to Avoid

1. **Fixed counts** (`toHaveLength(5)`) - breaks when features added
2. **Testing library behavior** - tests nothing about your code
3. **Arbitrary existence checks** (`toContain('hello')`) - no functional purpose
4. **Mocking internals** - couples to implementation
5. **CLI process spawning** - flaky, environment-dependent
6. **Real timers** - slow execution
7. **Per-test DB connections** - expensive setup/teardown

---

## Category 1: Misclassified Unit Tests (Move to Integration)

These tests are labeled as "unit" but require heavy mocking of internal components. They should be moved to `tests/integration/` and use real components with mocks only at external boundaries.

### AI Generator Tests (25 files)

All files in `tests/unit/content/generators/ai/` should move to `tests/integration/content/generators/ai/`.

**Common violations across all files:**
- Heavy mocking of `PromptLoader`, `ModelTierSelector`, `createAIProvider`
- Testing protected methods via type casting (`as ProtectedXxxGenerator`)
- Arbitrary existence checks (`expect(generator).toBeDefined()`)

| File | Specific Issues | Recommended Fix |
|------|-----------------|-----------------|
| `hot-take-generator.test.ts` | Fixed counts: `toHaveLength(192)` L187, `toHaveLength(32)` L193 | Move to integration; replace fixed counts with range assertions |
| `houseboy-vent-generator.test.ts` | Tests protected methods via type casting | Move to integration; test public behavior only |
| `happy-to-see-me-generator.test.ts` | Tests protected methods via type casting | Move to integration; test public behavior only |
| `seasonal-generator.test.ts` | Module-level `jest.mock('@/api/ai/index.js')` | Move to integration; use real PromptLoader |
| `yo-momma-generator.test.ts` | Arbitrary existence checks | Move to integration; remove existence checks |
| `weather-generator.test.ts` | Mocks `createAIProvider` and `generatePersonalityDimensions` | Move to integration; mock only external weather API |
| `alien-field-report-generator.test.ts` | Fixed counts: `.toBe(5)` L345-352, `.toBe(8)` L367, `.toBe(5)` L380 | Move to integration; use `toBeGreaterThan(0)` |
| `daily-roast-generator.test.ts` | Fixed count: `toBe(4)` L305 | Move to integration; test presence not count |
| `language-lesson-generator.test.ts` | Fixed counts: `toHaveLength(6)` L133/L148, `toHaveLength(7)` L164, `toHaveLength(1)` L175 | Move to integration; use flexible assertions |
| `serial-story-generator.test.ts` | Heavy mocking of ContentRepository and AI providers | Move to integration; use test database |
| `wakeup-greeting-generator.test.ts` | Arbitrary existence checks | Move to integration; remove existence checks |
| `word-of-the-day-generator.test.ts` | Arbitrary existence checks | Move to integration; remove existence checks |
| `local-news-generator.test.ts` | Mocks RSSClient internally | Move to integration; mock at HTTP boundary |
| `base-news-generator.test.ts` | Module-level mocks for multiple internal modules | Move to integration; reduce mock surface |
| `novel-insight-generator.test.ts` | Tests private Math.random selection logic | Move to integration; test output behavior |
| `haiku-generator.test.ts` | Module-level mocks | Move to integration; use real PromptLoader |
| `shower-thought-generator.test.ts` | Arbitrary existence checks | Move to integration; test behavior |
| `paradox-engine-generator.test.ts` | Arbitrary existence checks | Move to integration; test behavior |
| `news-generator.test.ts` | Arbitrary existence checks | Move to integration; test behavior |
| `time-perspective-generator.test.ts` | Fixed count: `toHaveLength(5)` L48 | Move to integration; use presence assertion |
| `iss-observer-generator.test.ts` | Mocks createAIProvider, personality, ISSClient | Move to integration; mock only ISS API |
| `sleep-greeting-generator.test.ts` | Arbitrary existence checks | Move to integration; test behavior |
| `global-news-generator.test.ts` | Fixed count: `toHaveLength(2)` L148 | Move to integration; use presence assertion |
| `fortune-cookie-generator.test.ts` | Fixed counts: `toHaveLength(6)` L172, `toHaveLength(5)` L347; mocks protected methods | Move to integration; test public API |
| `tech-news-generator.test.ts` | Fixed count: `toHaveLength(3)` L124 | Move to integration; use presence assertion |

### CLI Command Tests (11 files)

All files in `tests/unit/cli/commands/` should move to `tests/integration/cli/commands/`.

| File | Specific Issues | Recommended Fix |
|------|-----------------|-----------------|
| `test-ai.test.ts` | Mocks `createAIProvider`, `validateConnection` | Move to integration; mock AI API responses |
| `generate.test.ts` | Mocks bootstrap, orchestrator | Move to integration; test actual command flow |
| `content-test.test.ts` | Real timers L269-280; mocks ContentRegistry | Move to integration; use fake timers |
| `test-ha.test.ts` | Mocks HomeAssistantClient entirely | Move to integration; mock HA WebSocket |
| `content-list.test.ts` | Mocks ContentRegistry.getInstance() | Move to integration; use real registry |
| `frame.test.ts` | Mocks FrameDecorator, VestaboardClient | Move to integration; mock Vestaboard API |
| `db-migrate.test.ts` | Mocks knex migrations | Move to integration; use test database |
| `circuit.test.ts` | Mocks CircuitBreakerService | Move to integration; use test database |
| `test-board.test.ts` | Mocks VestaboardClient | Move to integration; mock HTTP responses |
| `db-reset.test.ts` | Mocks knex, readline | Move to integration; use test database |
| `auth.test.ts` | Mocks multiple auth services | Move to integration; use test database |

### Storage Tests (17 files)

Files in `tests/unit/storage/` that use database connections should move to `tests/integration/storage/`.

| File | Specific Issues | Recommended Fix |
|------|-----------------|-----------------|
| `content-repository.test.ts` | Uses real knex connection | Already integration-style; move directory |
| `knex.test.ts` | Tests database connectivity | Move to integration |
| `validation-attempts.test.ts` | Per-test `resetKnexInstance()` L22-24 | Move to integration; use `beforeAll` |
| `repositories/credential-repo.test.ts` | Database operations | Move to integration |
| `repositories/content-repo.test.ts` | Database operations | Move to integration |
| `repositories/circuit-breaker-repo.test.ts` | Database operations | Move to integration |
| `repositories/session-repo.test.ts` | Database operations | Move to integration |
| `repositories/magic-link-repo.test.ts` | Database operations | Move to integration |
| `repositories/user-repo.test.ts` | Database operations | Move to integration |
| `models/vote.test.ts` | Per-test DB reset L43-45 | Move to integration; use `beforeAll` |
| `models/log.test.ts` | Per-test DB reset L13-15 | Move to integration; use `beforeAll` |
| `models/magic-link.test.ts` | Database operations | Move to integration |
| `models/credential.test.ts` | Database operations | Move to integration |
| `models/user.test.ts` | Database operations | Move to integration |
| `models/content.test.ts` | Database operations | Move to integration |
| `models/session.test.ts` | Database operations | Move to integration |
| `migrations/*.test.ts` | Tests migration execution | Move to integration |

### Other Orchestration Tests

| File | Specific Issues | Recommended Fix |
|------|-----------------|-----------------|
| `tests/unit/content/orchestrator-tool-based.test.ts` | Mocks ContentSelector, FrameDecorator, VestaboardClient | Move to integration |
| `tests/unit/content/generators/notification-generator.test.ts` | Tests abstract class behavior with mocks | Move to integration |
| `tests/unit/content/generators/ai-prompt-generator.test.ts` | Heavy mocking of PromptLoader, ModelTierSelector | Move to integration |
| `tests/unit/content/generators/ai-prompt-generator-template-method.test.ts` | Tests template method pattern with mocks | Move to integration |
| `tests/unit/content/generators/sleep-mode-generator.test.ts` | Mocks composite sub-generators | Move to integration |
| `tests/unit/content/generators/minor-update.test.ts` | Mocks orchestrator cache | Move to integration |
| `tests/unit/bootstrap.test.ts` | Mocks all bootstrap dependencies | Move to integration |
| `tests/unit/scheduler/event-handler.test.ts` | Real timers L137, L756, L780, L797; mocks HA client | Move to integration; use fake timers |
| `tests/unit/scheduler/cron-scheduler.test.ts` | Mocks CronJob class | Move to integration |
| `tests/unit/services/weather-service.test.ts` | Mocks RapidAPI client | Move to integration; mock HTTP |
| `tests/unit/services/content-data-provider.test.ts` | Real timers L195-222 | Move to integration; use fake timers |
| `tests/unit/services/circuit-breaker-service.test.ts` | Mocks repository | Move to integration; use test DB |

---

## Category 2: Delete (Testing Library/TypeScript Behavior)

These tests verify TypeScript compiler behavior or library internals, not application code.

| File | Issue | Action |
|------|-------|--------|
| `tests/unit/types/ai.test.ts` | Tests TypeScript type definitions compile | Delete |
| `tests/unit/types/content-generator.test.ts` | Tests TypeScript type definitions compile | Delete |
| `tests/unit/types/data-sources.test.ts` | Tests TypeScript type definitions compile | Delete |
| `tests/unit/fixtures/anthropic-responses.test.ts` | Tests fixture data structure | Delete or move to fixture validation script |
| `tests/unit/fixtures/openai-responses.test.ts` | Tests fixture data structure | Delete or move to fixture validation script |
| `tests/unit/fixtures/index.test.ts` | Tests fixture exports | Delete |

---

## Category 3: Fix In Place (Valid Unit Tests with Issues)

These are legitimate unit tests for pure functions but have specific violations to fix.

### Fixed Count Violations

| File | Line(s) | Current | Fix |
|------|---------|---------|-----|
| `tests/unit/config/model-tiers.test.ts` | 18-23, 40-45, 84-88 | `expect(tiers).toHaveLength(3)` | `expect(tiers.length).toBeGreaterThan(0)` or test specific tier presence |
| `tests/unit/content/generators/patterns/pattern-library.test.ts` | Various | Fixed pattern counts | Use `toContainEqual()` for specific patterns |
| `tests/unit/api/ai/model-tier-selector.test.ts` | 45, 67, 89 | Fixed model counts | Test specific model presence |

### Real Timer Usage

| File | Line(s) | Fix |
|------|---------|-----|
| `tests/unit/cli/commands/content-test.test.ts` | 269-280 | Add `jest.useFakeTimers()` in `beforeEach` |
| `tests/unit/scheduler/event-handler.test.ts` | 137, 756, 780, 797 | Add `jest.useFakeTimers()` and `jest.advanceTimersByTime()` |
| `tests/unit/services/content-data-provider.test.ts` | 195-222 | Add `jest.useFakeTimers()` |

### Per-Test Database Connections

| File | Line(s) | Current | Fix |
|------|---------|---------|-----|
| `tests/unit/storage/validation-attempts.test.ts` | 22-24 | `beforeEach(() => resetKnexInstance())` | Move to `beforeAll` |
| `tests/unit/storage/models/vote.test.ts` | 43-45 | `beforeEach(() => resetKnexInstance())` | Move to `beforeAll` |
| `tests/unit/storage/models/log.test.ts` | 13-15 | `beforeEach(() => resetKnexInstance())` | Move to `beforeAll` |

---

## Category 4: Integration Tests with Issues

### CLI Process Spawning

| File | Line(s) | Current | Fix |
|------|---------|---------|-----|
| `tests/integration/cli/content-commands.test.ts` | 81, 106, 131 | `execSync('npm run content:list')` | Import and call `contentList()` directly |
| `tests/integration/cli/npm-scripts-validation.test.ts` | 21, 36, 53, 71 | `execSync('npm run ...')` | Import and call command functions directly |

**Example fix:**
```typescript
// Before (anti-pattern)
it('lists content generators', () => {
  const output = execSync('npm run content:list', { encoding: 'utf8' });
  expect(output).toContain('haiku');
});

// After (correct)
import { contentList } from '@/cli/commands/content-list.js';

it('lists content generators', async () => {
  const result = await contentList();
  expect(result.generators).toContainEqual(
    expect.objectContaining({ id: 'haiku' })
  );
});
```

### Fixed Counts in Integration Tests

| File | Line(s) | Current | Fix |
|------|---------|---------|-----|
| `tests/integration/web/routes/content.test.ts` | 268, 325 | `toHaveLength(N)` | Use `toBeGreaterThan(0)` or `toContainEqual()` |
| `tests/integration/web/server-database.test.ts` | 233 | `toHaveLength(N)` | Use presence assertions |

---

## Category 5: Files Passing Standards (No Changes Needed)

These files correctly test pure functions with deterministic input/output:

| File | Reason |
|------|--------|
| `tests/unit/content/text-layout.test.ts` | Pure string formatting functions |
| `tests/unit/content/tools/preview-renderer.test.ts` | Pure ASCII rendering |
| `tests/unit/content/tools/submit-content.test.ts` | Pure validation logic |
| `tests/unit/content/personality/template-resolver.test.ts` | Pure template string resolution |
| `tests/unit/content/personality/dimensions.test.ts` | Pure personality dimension calculations |
| `tests/unit/content/generators/patterns/pattern-library.test.ts` | Pure pattern generation (fix counts) |
| `tests/unit/content/generators/static-fallback-generator.test.ts` | Pure static content |
| `tests/unit/content/generators/pattern-generator.test.ts` | Pure pattern selection |
| `tests/unit/scheduler/trigger-matcher.test.ts` | Pure pattern matching |
| `tests/unit/utils/timezone.test.ts` | Pure date/time calculations |
| `tests/unit/utils/validators.test.ts` | Pure input validation |
| `tests/unit/utils/error-handler.test.ts` | Pure error formatting |
| `tests/unit/api/vestaboard/character-encoder.test.ts` | Pure character encoding |
| `tests/unit/api/vestaboard/frame-decorator.test.ts` | Pure frame layout |
| `tests/unit/api/ai/prompt-loader.test.ts` | Pure file loading (reads from disk) |
| `tests/web/lib/textToCharCodes.test.ts` | Pure character conversion |
| `tests/unit/__helpers__/timezone.test.ts` | Pure helper functions |
| `tests/unit/__helpers__/mockAIProvider.test.ts` | Pure mock creation |
| `tests/unit/__helpers__/outputAssertions.test.ts` | Pure assertion helpers |

---

## Implementation Plan

### Phase 1: Quick Wins (1-2 hours)
1. Delete 6 files testing TypeScript/library behavior
2. Fix 3 files with per-test DB connections (change `beforeEach` to `beforeAll`)
3. Fix 3 files with real timers (add `jest.useFakeTimers()`)

### Phase 2: CLI Refactor (2-3 hours)
1. Refactor 2 integration test files to call functions directly instead of spawning processes
2. Move 11 CLI command tests from unit to integration

### Phase 3: Storage Reorganization (2-3 hours)
1. Move 17 storage tests from `tests/unit/storage/` to `tests/integration/storage/`
2. Update imports and ensure test database is used

### Phase 4: Generator Tests (4-6 hours)
1. Move 25 AI generator tests to integration
2. Refactor to use real PromptLoader with mock AI provider at boundary
3. Remove arbitrary existence checks
4. Replace fixed counts with flexible assertions

### Phase 5: Remaining Orchestration Tests (2-3 hours)
1. Move remaining orchestration tests to integration
2. Reduce mock surface area
3. Test behavior, not implementation

---

## Appendix: Test Naming Improvements

### Bad → Good Examples

| Current (Implementation-focused) | Improved (Behavior-focused) |
|----------------------------------|----------------------------|
| `it('calls aiProvider.generate()')` | `it('generates content using AI provider')` |
| `it('should have 5 generators registered')` | `it('registers all core generators')` |
| `it('returns the correct prompt file')` | `it('loads system prompt for major updates')` |
| `it('mocks the weather service')` | `it('fetches current weather for content')` |

### Files Needing Name Improvements

Most files in `tests/unit/content/generators/ai/` have test names like:
- `it('should return the correct system prompt file')`
- `it('should return the correct user prompt file')`
- `it('should be defined')`

These should be renamed to describe behavior:
- `it('uses major-update-base system prompt')`
- `it('includes weather data in prompt context')`
- (delete existence checks entirely)

---

## Metrics After Fixes

Expected improvement after implementing all fixes:

| Metric | Before | After |
|--------|--------|-------|
| Unit tests (pure functions) | ~27 | ~27 |
| Integration tests | ~29 | ~109 |
| Deleted tests | 0 | 6 |
| Tests with anti-patterns | ~93 | 0 |
| Standards compliance | 17% | 100% |
