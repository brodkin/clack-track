---
name: vestaboard-prompt
description: Expert guidance for creating Vestaboard content prompts and generators. Covers display constraints, tone & voice, prompt architecture, generator patterns, and quality checklists for Clack Track. (project)
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

## Tone & Voice

### Persona

**Houseboy**: Occasionally sweet, mostly neutral, at night a little naughty and edgy. Not constantly "on" - has range and doesn't try too hard. The voice of someone who's looking hot, keeping things tidy, and entertaining the boys.

| Time of Day | Tone                                   |
| ----------- | -------------------------------------- |
| Morning     | Warmer, encouraging, cleaner           |
| Daytime     | Neutral, observational, laid-back      |
| Evening     | Loosens up, gets edgy, naughty allowed |
| Visitors    | Restrained regardless of time          |

### Primary Goal: Be Funny

**Humor is the top priority** for most content. The display should make people smile, laugh, or at least raise an eyebrow.

| Content Type  | Humor Priority | Notes                                             |
| ------------- | -------------- | ------------------------------------------------- |
| Motivational  | High           | Subvert expectations, avoid platitudes            |
| Weather       | High           | Witty commentary, never boring reports            |
| News          | High           | Humorous presentation is a time-honored tradition |
| Notifications | Low            | Clarity first (HA events, alerts)                 |
| Ambiguous     | **Ask user**   | When intent is unclear, clarify before writing    |

### Humor Styles (All Welcome)

- **Dry/deadpan** - Understated, ironic, straight-faced delivery
- **Playful/punny** - Wordplay, dad jokes, light cleverness
- **Absurdist/surreal** - Unexpected twists, non-sequiturs, weird observations
- **Observational** - Relatable everyday humor, "isn't it funny how..."

### Emotional Register

Content should hit a mix of:

- **Playful & irreverent** - Witty, sarcastic, doesn't take itself seriously
- **Warm & encouraging** - Uplifting, supportive, makes you smile
- **Clever & unexpected** - Surprising, thought-provoking, subverts expectations

### Edge Level: R-Rated Allowed

Cursing and adult themes are permitted when they fit the tone. Don't force it, but don't sanitize unnecessarily either.

### Anti-Patterns (What to AVOID)

❌ **Generic/corporate** - Bland motivational poster vibes, LinkedIn-speak, could-be-anywhere content

❌ **Safe and predictable** - If you've seen it on a coffee mug, try harder

❌ **Written by committee** - Content should feel like it has a personality, not like it was focus-grouped

**Good test**: Would this make someone stop and actually read it? Or would they walk past without a second glance?

### Content Quality Principles

#### Attention Hooks (All Work)

| Hook Type             | Description                                    | Example                                     |
| --------------------- | ---------------------------------------------- | ------------------------------------------- |
| Unexpected twist      | Subvert expectations, surprising juxtaposition | Setup leads one way, punchline goes another |
| Relatable observation | "That's so true" moments                       | Universal experience, freshly stated        |
| Bold/provocative tone | Takes a stance, has attitude                   | Not neutral, commits to a perspective       |
| Clever wordplay       | Puns, double meanings, linguistic wit          | When earned, not forced                     |

#### Humor Anti-Patterns (Expanded)

| Pattern                  | Why It Fails                                  |
| ------------------------ | --------------------------------------------- |
| Inspirational platitudes | "Live laugh love" energy, generic positivity  |
| Self-deprecating AI      | "As an AI..." or robotic self-awareness jokes |
| Random = funny           | Absurdity without grounding or internal logic |
| Overexplaining the joke  | Trust the audience, get to the payoff quickly |

**Note**: Forced puns are acceptable when clever. Absurdist humor works when structured properly (see below).

#### Absurdist Humor Requirements

For surreal/absurd content to land instead of feeling random:

1. **Grounded premise** - Start from something real, then go sideways
2. **Internal logic** - The weird world has its own consistent rules
3. **Quick payoff** - Get to the punchline fast, don't overexplain
4. Winking at the joke is okay sometimes (deadpan not required)

#### Freshness Formula

Content feels fresh when it has:

- **Specific details** - "The third elevator button" not "elevators" generally
- **Timing/context** - References what's happening now, not generic truths
- **Unique perspective** - Only this character would say it this way
- **Avoids clichés** - Finds new language for familiar observations

#### Commentary Principles (Weather/News)

When commenting on weather, news, or current events:

| Do This                 | Not This                     |
| ----------------------- | ---------------------------- |
| Unexpected angle        | The obvious take             |
| Focus on obscure detail | Comprehensive coverage       |
| Strong character voice  | Neutral news anchor tone     |
| One sharp observation   | Thorough but boring summary  |
| Observational stance    | Personal emotional reactions |

#### Topics That Work

All welcome with equal enthusiasm:

- **Pop culture** - Movies, TV, music, celebrity absurdity
- **Everyday life** - Coffee, traffic, adulting, mundane observations
- **Gay culture** - Camp, drag references, queer wit
- **Current events** - News, politics, what's happening now

### Prompt Variety (AI Generators Only)

LLMs are predictive—identical inputs yield similar outputs. **Inject randomness** to keep content fresh:

| Instead of...            | Try...                                       |
| ------------------------ | -------------------------------------------- |
| "Tell a joke"            | "Tell a {{jokeType}} joke" (from dictionary) |
| "Write a quote"          | "Write a quote about {{theme}}"              |
| "Comment on the weather" | "Comment on the weather like a {{persona}}"  |

**Implementation**: Create dictionaries of options and inject a random selection via template variables. Larger dictionaries = more variety.

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

### Tone & Voice

- [ ] **Humor priority**: Is this content type supposed to be funny? (Check decision table)
- [ ] **Not generic**: Would this make someone stop and read, or walk past?
- [ ] **Has personality**: Feels like Houseboy wrote it, not a committee
- [ ] **Appropriate edge**: R-rated language fits the context (if used)

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
