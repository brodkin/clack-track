---
name: vestaboard-prompt
description: Expert guidance for creating Vestaboard content prompts and generators. Covers display constraints, prompt architecture, generator patterns, and quality checklists for Clack Track.
---

# Vestaboard Prompt Expert

Create effective prompts and generators for Vestaboard split-flap displays in the Clack Track project.

## Display Constraints (Hardware Limits)

| Property      | Value                 | Notes                                      |
| ------------- | --------------------- | ------------------------------------------ |
| Grid Size     | 6 rows × 22 columns   | 132 total characters                       |
| Line Width    | **21 characters max** | Content area (column 1 reserved for frame) |
| Content Lines | 1-5 lines             | Row 6 reserved for time/weather frame      |
| Case          | UPPERCASE ONLY        | Hardware limitation - no lowercase         |

### Approved Character Set

```
Letters:     A-Z (uppercase only)
Numbers:     0-9
Color Emoji: 🟥 🟧 🟨 🟩 🟦 🟪 ⬛️ (space for white)
Punctuation: ! @ # $ ( ) - + & = ; : ' " % , . / ? °
```

**Rejected Characters** (cause display errors):

- Lowercase letters (a-z)
- Unicode symbols, accents, or emojis (except color blocks)
- Curly quotes (" ") - use straight quotes (" ')
- Em/en dashes (— –) - use hyphen (-)
- Ellipsis (…) - use three periods (...)

## Prompt Architecture

### Three-Layer System

| Layer         | Location                  | Purpose                                               | Mechanism                   |
| ------------- | ------------------------- | ----------------------------------------------------- | --------------------------- |
| System Prompt | `prompts/system/`         | Universal context (persona, constraints, personality) | Template vars `{{var}}`     |
| User Prompt   | `prompts/user/`           | Content-specific instructions                         | Plain text or template vars |
| Generator     | `src/content/generators/` | Data fetching, prompt orchestration                   | TypeScript class            |

### Template Variables (Auto-Injected)

These variables are automatically available in **system prompts**:

| Variable          | Source                | Example Value                 |
| ----------------- | --------------------- | ----------------------------- |
| `{{mood}}`        | PersonalityDimensions | "SASSY"                       |
| `{{energyLevel}}` | PersonalityDimensions | "HIGH"                        |
| `{{humorStyle}}`  | PersonalityDimensions | "SARCASTIC"                   |
| `{{obsession}}`   | PersonalityDimensions | "90S MOVIES"                  |
| `{{date}}`        | GenerationContext     | "Saturday, December 14, 2024" |
| `{{time}}`        | GenerationContext     | "10:30 AM"                    |
| `{{persona}}`     | Static                | "Houseboy"                    |

### Content-Specific Variables

Generators that need external data must:

1. Fetch the data in `generate()` method
2. Pass to `loadPromptWithVariables()` for template substitution

| Variable        | Used By          | Fetched From                    |
| --------------- | ---------------- | ------------------------------- |
| `{{weather}}`   | WeatherGenerator | WeatherService                  |
| `{{headlines}}` | NewsGenerator    | RSS feeds via BaseNewsGenerator |

## Prompt Type Decision Table

| Content Type        | Generator Base          | Model Tier | Needs Data?           | Example              |
| ------------------- | ----------------------- | ---------- | --------------------- | -------------------- |
| Motivational quotes | AIPromptGenerator       | LIGHT      | No                    | Affirmations, quotes |
| Weather commentary  | AIPromptGenerator       | LIGHT      | Yes (`{{weather}}`)   | Witty weather takes  |
| News summary        | AIPromptGenerator       | MEDIUM     | Yes (`{{headlines}}`) | News humor           |
| HA notifications    | NotificationGenerator   | N/A        | Yes (eventData)       | Person arrived       |
| Static fallback     | StaticFallbackGenerator | LIGHT      | No                    | Pre-written messages |
| Greeting            | ProgrammaticGenerator   | LIGHT      | No                    | Time-based greetings |

## Workflow: Creating a New Generator

### Step 1: Choose Your Pattern

**Pattern A - Personality-Only** (simplest)

- No external data needed
- Just system + user prompts with personality injection
- Examples: motivational, affirmation, dad-joke

**Pattern B - Data-Injection**

- Needs external data (weather, news, sports, etc.)
- Override `generate()` to fetch data
- Inject via template variables
- Examples: weather-focus, news-summary, sports-score

**Pattern C - Event Notification**

- Triggered by Home Assistant events
- P0 priority (immediate display)
- No frame decoration
- Examples: person-arrived, door-opened, temperature-alert

### Step 2: Create Prompt Files

**User prompt location:** `prompts/user/<content-type>.txt`

Follow the templates in [templates.md](./templates.md).

### Step 3: Create Generator Class

Follow the scaffolds in [generator-patterns.md](./generator-patterns.md).

### Step 4: Register Generator

Add to `src/content/registry/register-core.ts` or create a new registration module.

### Step 5: Write Tests

Create tests in `tests/unit/content/generators/`.

## Quality Checklist

Run through this checklist before submitting a new prompt/generator:

### Prompt Content

- [ ] **21-char limit**: Every line is 21 characters or fewer
- [ ] **UPPERCASE only**: No lowercase letters anywhere
- [ ] **Approved chars**: Only A-Z, 0-9, color emoji, approved punctuation
- [ ] **No word wrapping**: Words never split across lines
- [ ] **1-5 lines**: Content is within line limits
- [ ] **No meta-talk**: Prompt doesn't ask AI to acknowledge the request
- [ ] **Standalone**: Content makes sense without context

### Template Variables

- [ ] **Correct syntax**: `{{variableName}}` with double braces
- [ ] **Defined vars**: All variables are either auto-injected or fetched
- [ ] **No typos**: Variable names match exactly (case-sensitive)

### Generator Class

- [ ] **Correct base class**: Extends appropriate abstract class
- [ ] **Model tier**: Appropriate tier selected (LIGHT/MEDIUM/HEAVY)
- [ ] **Data fetching**: External data fetched in `generate()` if needed
- [ ] **Error handling**: Graceful fallback if data fetch fails
- [ ] **applyFrame**: Set `true` for P2/P3 generators (adds time/weather)

### Registration

- [ ] **Unique ID**: kebab-case, descriptive (e.g., `weather-focus`)
- [ ] **Priority**: P0=NOTIFICATION, P2=NORMAL, P3=FALLBACK
- [ ] **Model tier**: Matches generator constructor

### Tests

- [ ] **Unit tests**: Generator class tested with mocked dependencies
- [ ] **Prompt loading**: Validates prompt files exist
- [ ] **Output format**: Verifies output structure

## Common Mistakes

### Wrong: Line Too Long

```
GOOD MORNING LAKEWOOD CA  ← 25 chars, FAILS
```

### Right: Within Limit

```
GOOD MORNING LAKEWOOD   ← 21 chars, PASSES
```

### Wrong: Lowercase Letters

```
Good Morning Lakewood   ← Has lowercase, FAILS
```

### Right: All Uppercase

```
GOOD MORNING LAKEWOOD   ← All caps, PASSES
```

### Wrong: Curly Quotes

```
"HELLO WORLD"           ← Curly quotes, FAILS
```

### Right: Straight Quotes

```
"HELLO WORLD"           ← Straight quotes, PASSES
```

### Wrong: Asking AI to Acknowledge

```
Please create a motivational message that...
Here's your message:
```

### Right: Direct Instruction

```
Create an inspiring motivational message for the day.
```

## File Paths Reference

| Purpose                 | Location                                |
| ----------------------- | --------------------------------------- |
| System prompts          | `prompts/system/`                       |
| User prompts            | `prompts/user/`                         |
| Static fallbacks        | `prompts/static/`                       |
| AI generators           | `src/content/generators/ai/`            |
| Programmatic generators | `src/content/generators/programmatic/`  |
| Generator base classes  | `src/content/generators/`               |
| Registration            | `src/content/registry/register-core.ts` |
| Tests                   | `tests/unit/content/generators/`        |

## Supporting Files

- [templates.md](./templates.md) - User prompt templates with examples
- [generator-patterns.md](./generator-patterns.md) - TypeScript generator scaffolds
