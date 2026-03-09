# ADR-0001: Test Suite Restructuring

## Status

Accepted

## Date

2026-03-09

## Context

The existing test suite had accumulated approximately 130 unit test files, but the majority were misclassified or provided no behavioral value:

- **~75% of "unit" tests were actually integration tests.** They tested orchestration flows with mocked dependencies (AI providers, database, Vestaboard client) rather than pure functions with deterministic input/output. Placing them in the unit directory misrepresented what the unit suite actually covered and inflated unit test counts.

- **23 test files provided zero behavioral value.** These fell into several categories: error class constructors, factory instantiation patterns, TypeScript type contracts, test helper infrastructure, migration schema details, and repository wrapper tests that only verified pass-through behavior. None validated meaningful application logic beyond what the underlying libraries or base classes already guaranteed.

- **28 AI generator test files contained identical copy-paste boilerplate.** Every generator test repeated the same constructor, prompt file path, `validate()`, and model tier assertions. These all exercise inherited behavior from the `AIPromptGenerator` base class, which is already covered by `ai-prompt-generator.test.ts`. The duplication added maintenance burden without additional coverage.

- **ts-jest transformer was slow.** TypeScript compilation through ts-jest meant the full test suite took minutes to complete, discouraging frequent local test runs.

- **`--forceExit` was required.** Dangling handles from database connections initialized in unit test setup files forced the use of `--forceExit` as a band-aid, masking resource cleanup problems.

- **Per-test database connections caused unnecessary overhead.** Some test files created and tore down database connections for every individual test case rather than sharing connections across the file.

## Decision

Restructure the test suite to enforce clear boundaries between unit and integration tests, eliminate zero-value tests, and improve execution speed.

### 1. Delete zero-value tests (23 files)

Remove tests that verify TypeScript types, library behavior, error class constructors, factory instantiation, test helper infrastructure, and migration schema details. These tests do not validate application behavior and provide no regression protection.

### 2. Strip boilerplate from AI generator tests (28 files)

Remove constructor, prompt file path, `validate()`, and model tier assertions from individual generator test files. These duplicate coverage already provided by `ai-prompt-generator.test.ts`. Retain only generator-specific logic tests (topic randomization, data injection, template variable handling).

### 3. Move mock-heavy tests to integration (44 files across 4 domains)

Reclassify tests that depend on mocked external boundaries as integration tests:

- **API/config tests** (8 files) -- provider clients, configuration loading
- **CLI/bootstrap tests** (13 files) -- command execution, dependency initialization
- **Content/orchestrator/frame tests** (12 files) -- content pipeline, frame decoration, generator selection
- **Storage/scheduler/service tests** (11 files) -- database operations, cron scheduling, service layer

### 4. Replace ts-jest with @swc/jest

Switch the TypeScript transformer from ts-jest to @swc/jest for 2-5x faster compilation. SWC performs transpilation-only (no type checking), which is appropriate for test execution since type checking is handled separately by `tsc`.

### 5. Split Jest setup files per project

Create separate setup files for each test project:

- **Unit tests** get minimal setup with no database teardown, no global mocks for external services
- **Integration tests** get full setup with database lifecycle management, mock cleanup
- **E2E tests** get full setup with extended timeouts and server lifecycle

This eliminates the overhead of initializing database connections for pure-function unit tests.

### 6. Remove --forceExit

With per-project setup files, unit tests no longer initialize database connections, eliminating the dangling handles that required `--forceExit`. Each project properly manages its own resource lifecycle.

## Unit test criteria (post-restructuring)

Reserve unit tests exclusively for pure functions with deterministic input/output and no external dependencies:

- `text-layout.ts` -- character wrapping, line breaking, padding
- `CharacterEncoder` -- character code mapping and validation
- Validators with complex conditional logic
- Date/time calculations and formatting
- AI generator-specific logic -- topic randomization, data injection, template variable resolution

If a test requires mocking an external boundary (AI provider, database, HTTP client, WebSocket), it belongs in integration.

## Alternatives Considered

### 1. Keep all tests, just speed up the transformer

Switching to @swc/jest alone would improve execution speed but would not fix the classification problem. Mock-heavy tests in the unit directory would continue to mislead about actual unit coverage. The bloated unit suite would still slow down git hook runs unnecessarily.

### 2. Full Vitest migration

Migrating from Jest to Vitest would modernize the test infrastructure but carries higher risk and a larger blast radius. The core problem was test classification and zero-value tests, not the test framework itself. A framework migration could be evaluated separately once the restructuring stabilizes.

### 3. Delete all generator tests

Removing all 28 AI generator test files entirely would be the simplest approach but is too aggressive. Generator-specific logic tests -- topic selection, data injection into template variables, conditional behavior -- provide genuine regression protection and should be preserved.

## Consequences

### Positive

- **Unit suite drops from ~130 to ~62 files.** The 23 deleted zero-value files and 44 files reclassified to integration reduce the unit suite by more than half. Git hook runs (which execute unit tests) complete dramatically faster, improving developer feedback loops.
- **Clear classification boundary.** Unit tests mean pure functions; integration tests mean component interactions with mocked boundaries. No ambiguity about where new tests belong.
- **No more --forceExit.** Proper per-project setup eliminates dangling database handles, removing a long-standing band-aid that could mask real resource leaks.
- **2-5x faster TypeScript compilation.** @swc/jest transpilation-only approach eliminates the overhead of ts-jest's type checking during test runs.
- **Reduced maintenance burden.** Eliminating 23 zero-value files and stripping boilerplate from 28 generator files means less code to maintain when refactoring base classes or shared infrastructure.

### Negative

- **One-time migration effort across 80+ test files.** Deleting, moving, and refactoring test files requires careful execution to avoid accidentally losing valuable assertions.
- **Team must learn new classification criteria.** Developers need to understand the unit vs. integration boundary to place new tests correctly from the start.
- **New tests require deliberate placement.** Without the old pattern of "default to unit," developers must actively decide where each test belongs.

### Risks

- **Temporary coverage dip.** Some deleted tests may have contained unique assertions not covered elsewhere. This is mitigated by preserving all tests that validate meaningful application behavior and by verifying coverage metrics after the migration.
- **Perceived regression in test counts.** Developers accustomed to seeing ~130 unit tests may interpret the drop to ~62 as a loss of quality. This ADR documents the rationale: the removed tests were either zero-value, duplicated, or misclassified.
