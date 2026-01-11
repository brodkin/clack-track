---
name: vestaboard-prompt
description: Expert guidance for creating Vestaboard content prompts and generators. Covers display constraints, tone & voice, prompt architecture, generator patterns, and quality checklists for Clack Track. (project)
---

# Vestaboard Prompt Expert

Create effective prompts and generators for Vestaboard split-flap displays in the Clack Track project.

## Display Constraints (Hardware Limits)

The Vestaboard has a fixed 6 rows × 22 columns grid (132 characters). Content generators operate in one of two modes:

| Mode            | Line Width   | Content Rows | Use Case                                |
| --------------- | ------------ | ------------ | --------------------------------------- |
| **Framed**      | 21 chars max | 5 rows       | Most content (time/weather frame added) |
| **Full Screen** | 22 chars max | 6 rows       | Layouts, notifications, ASCII art       |

**Framed mode** (default for most generators):

- Column 22 (rightmost): Reserved for color bar
- Row 6 (bottom): Reserved for time/weather info bar
- Content area: 21 chars × 5 rows

**Full screen mode** (outputMode: 'layout' or applyFrame: false):

- All 22 columns available
- All 6 rows available
- Generator controls entire display

**Template variables** adapt automatically:

- `{{maxChars}}` → 21 (framed) or 22 (full screen)
- `{{maxLines}}` → 5 (framed) or 6 (full screen)

| Property   | Value               | Notes                                 |
| ---------- | ------------------- | ------------------------------------- |
| Total Grid | 6 rows × 22 columns | 132 total characters (hardware fixed) |
| Case       | UPPERCASE ONLY      | Hardware limitation - no lowercase    |

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

#### Processing External Data

When a generator receives a data payload (headlines, weather, scores), more data means more choices—and higher chance of picking the boring one.

**The Selection Approach:**

1. **Scan for the outlier** - What's weird, unexpected, or ironic in the data?
2. **Skip the lead story** - Everyone's already talking about it
3. **Find the detail, not the summary** - "The CEO wore sneakers" beats "Company announces layoffs"

**For Weather:**

- Don't report conditions—they already know it's 72° and sunny
- Find the implication: "72 AND SUNNY / YOUR HOODIE COLLECTION WEEPS"
- Contrast expectation vs reality: "IT'S DECEMBER / WHY IS IT 80 DEGREES"

**For News:**

- Pick ONE headline, ignore the rest
- Find the absurd detail buried in the story
- Ask: "What would Houseboy notice that a news anchor wouldn't?"

**For Any Data-Heavy Content:**

```
Don't: Summarize the data comprehensively
Do:   React to one specific thing in the data
```

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

## Leveraging Personality Dimensions

The system prompt automatically injects personality dimensions that change over time. **Smart prompts exploit these for variety.**

### What's Available

| Dimension         | Variable          | Example Values                      | Refresh Rate |
| ----------------- | ----------------- | ----------------------------------- | ------------ |
| Mood              | `{{mood}}`        | SASSY, CHILL, CHAOTIC, REFLECTIVE   | Daily        |
| Energy Level      | `{{energyLevel}}` | HIGH, LOW, MEDIUM, MANIC            | Daily        |
| Humor Style       | `{{humorStyle}}`  | SARCASTIC, DEADPAN, PUNNY, ABSURD   | Daily        |
| Current Obsession | `{{obsession}}`   | 90S MOVIES, TRUE CRIME, HOUSEPLANTS | Weekly       |

### Creative Uses in User Prompts

**Amplify the personality** by referencing dimensions explicitly:

```
Write a motivational message that reflects your current {{obsession}}.
Channel your {{mood}} energy into advice for starting the day.
```

**Constrain the personality** when content needs focus:

```
Regardless of mood, deliver today's weather with deadpan delivery.
Set aside your {{obsession}} and focus purely on the news.
```

### When to Amplify vs. Constrain

| Content Type  | Strategy      | Why                                            |
| ------------- | ------------- | ---------------------------------------------- |
| Motivational  | **Amplify**   | Personality makes generic advice interesting   |
| Weather       | Either        | Can be personality-driven OR straight delivery |
| News          | **Constrain** | Focus on headlines, not character quirks       |
| Notifications | **Constrain** | Clarity over personality                       |

### Obsession as Variety Engine

`{{obsession}}` is the highest-value dimension for variety because it:

- Changes topics completely (not just tone)
- Forces genuinely different content
- Prevents AI from falling into favorite patterns

**Example - Same prompt, different obsessions:**

Obsession: "90S MOVIES"
→ "NOBODY PUTS MONDAY IN A CORNER"

Obsession: "HOUSEPLANTS"
→ "YOUR MONDAY IS LIKE A SUCCULENT - REQUIRES MINIMAL EFFORT"

Obsession: "TRUE CRIME"
→ "MONDAY'S ALIBI: IT WAS JUST DOING ITS JOB"

## Variability Requirements (Mandatory)

**LLMs are predictive engines. Identical inputs produce identical-ish outputs.**

This isn't a suggestion—it's physics. A generator that doesn't inject variability WILL produce repetitive content. The 100th output will feel like the 1st.

### The 100-Output Test

Before approving any generator, ask: **"If I ran this 100 times, would I get meaningfully different content each time?"**

| Answer                             | Status  | Action                           |
| ---------------------------------- | ------- | -------------------------------- |
| Yes, external data changes daily   | ✅ Pass | News, weather, sports generators |
| Yes, I inject random themes/styles | ✅ Pass | Good use of dictionaries         |
| Yes, personality dimensions vary   | ⚠️ Weak | Helps, but insufficient alone    |
| No, the prompt is static           | ❌ Fail | Will produce repetitive slop     |

### Acceptable Variability Sources

| Source                 | Effectiveness | Example                                     |
| ---------------------- | ------------- | ------------------------------------------- |
| External data (live)   | ★★★★★         | RSS headlines, weather API, sports scores   |
| Style dictionaries     | ★★★★☆         | `{{style}}` from ["deadpan", "absurd", ...] |
| Theme dictionaries     | ★★★★☆         | `{{theme}}` from ["coffee", "traffic", ...] |
| Personality dimensions | ★★☆☆☆         | `{{mood}}`, `{{obsession}}` (changes daily) |
| Date/time alone        | ★☆☆☆☆         | Minimal variation day-to-day                |

### Why News & Weather Work

These generators pass the 100-output test naturally:

- **News**: RSS feeds provide new headlines daily → content must be different
- **Weather**: Temperature/conditions change → commentary adapts

**No dictionary injection needed** because the DATA is the variability.

### Named Failure Patterns

#### The Countdown Anti-Pattern

**What it is**: A generator that counts days to an event (Christmas, Friday, etc.)

**Why it fails**: The AI has ONE piece of variable data (the number). Everything else is up to the predictive model. Result: "X DAYS UNTIL [EVENT]" with slight rewording.

**The math**: 365 days × identical prompt = 365 variations of the same joke.

#### The Shower Thought Anti-Pattern

**What it is**: A generator that asks for "random deep thoughts" or "philosophical observations."

**Why it fails**: You're asking a predictive model to be unpredictable. It will converge on a small set of "profound-sounding" patterns.

**Common outputs**:

- "WHAT IF [COMMON THING] IS ACTUALLY [OPPOSITE]?"
- "WE ALL [UNIVERSAL EXPERIENCE] BUT NOBODY TALKS ABOUT IT"
- "TIME IS JUST [METAPHOR]"

**The fix**: Inject a random topic from a large dictionary:

```
Write a shower thought about: {{topic}}
Topics dictionary: [toast, escalators, passwords, ...]
```

## The Standalone Test

**Critical principle**: Viewers see ONLY your output. They never see the prompt.

### The Problem

When you write a prompt, you know:

- What you asked for
- The context you provided
- The references you made

The viewer knows NONE of this. They see a few lines of text on a display, with no explanation.

### Pass/Fail Criteria

| Scenario                                        | Result  |
| ----------------------------------------------- | ------- |
| Content makes complete sense with zero context  | ✅ Pass |
| Content requires knowing the prompt to "get it" | ❌ Fail |
| Reference is niche but self-explanatory         | ✅ Pass |
| Reference assumes insider knowledge             | ❌ Fail |

### The Niche-With-Context Rule

Niche content is GREAT—but you must provide enough context for outsiders.

**✅ GOOD - Standalone despite being niche:**

```
QAPLA! MAY YOUR
MONDAY BRING HONOR
TO YOUR HOUSE
```

(Anyone gets it's Klingon/Trek even without speaking Klingon)

**❌ BAD - Requires prompt knowledge:**

```
HEGHLU'MEGH QAQQU'
```

(Only works if you know the prompt asked for Klingon)

**✅ GOOD - Self-contextualizing reference:**

```
DRAG RACE WISDOM:
IF YOU CAN'T LOVE
YOURSELF...
```

(Identifies the reference, anyone can follow)

**❌ BAD - Assumes familiarity:**

```
SASHAY AWAY FROM
YOUR PROBLEMS TODAY
```

(Meaningless if you don't watch Drag Race)

### Applying the Test

Before finalizing content, ask:

1. If I showed this to a stranger with NO context, would they understand it?
2. If there's a reference, is it labeled or obvious enough?
3. Would this work as a standalone piece of art?

## Format-Critical Content Types

Some content types REQUIRE specific visual formatting to work. Others are format-flexible.

### Format-Required Types

| Content Type   | Required Format                                | Why It Matters                        |
| -------------- | ---------------------------------------------- | ------------------------------------- |
| Fortune Cookie | Centered text, lucky numbers on bottom row     | Mimics physical fortune cookie        |
| Haiku          | 3 lines, specific syllable pattern, whitespace | Form IS the content                   |
| Countdown      | Large number prominent, label below            | Visual emphasis on the NUMBER         |
| ASCII Art      | Exact character placement (full screen mode)   | Spatial relationships are the content |
| Menu/List      | Consistent alignment, clear structure          | Scanability requires formatting       |

### Format-Optional Types

| Content Type | Format                          | Flexibility             |
| ------------ | ------------------------------- | ----------------------- |
| Quote        | Can be left-aligned or centered | Content over form       |
| News         | Any readable layout             | Information is primary  |
| Weather      | Flexible layout                 | Commentary style varies |
| Motivational | Usually centered, not required  | Impact over aesthetics  |

### Whitespace as Meaning

**Whitespace is not empty—it's part of the composition.**

**Fortune Cookie format** (full screen mode, 6 rows available):

```
      YOUR CODE WILL
        COMPILE ON
       FIRST TRY...
          SOMEDAY

    14  28  42  7  3  9
```

- Top rows: Centered fortune text
- Penultimate row: Intentional blank (pause before numbers)
- Bottom row: Lucky numbers

**Why this matters**: Breaking the format breaks the joke. A fortune cookie without lucky numbers is just a fortune. The FORMAT is part of the content type's identity.

**Note**: Format-critical types often require **full screen mode** (`applyFrame: false`) to control all 6 rows. Framed mode reserves the bottom row for the info bar.

### Format Validation Checklist

For format-critical types, verify:

- [ ] Required whitespace is present
- [ ] Centering is consistent
- [ ] Special elements (numbers, patterns) are in correct positions
- [ ] Breaking the format would break the content

## Named Anti-Patterns (Generator Failures)

Learn from generators that have failed. Each represents a principle violation.

### 🚫 The Countdown Generator

**What it does**: Shows days until an event (Christmas, weekend, etc.)

**The failure**: Violates the 100-Output Test.

With only ONE variable (the count), every output is a variant of "N DAYS UNTIL X." The AI has nothing else to work with.

**Day 30:** "30 DAYS TIL CHRISTMAS / THE COUNTDOWN BEGINS"
**Day 15:** "15 DAYS TIL CHRISTMAS / HALFWAY THERE"
**Day 5:** "5 DAYS TIL CHRISTMAS / ALMOST TIME"

**Why it's unfixable**: The concept itself lacks variability. You can't dictionary-inject your way out—the core premise is repetitive.

**How to fix**: Don't build countdowns. Or, make them one-shot (Day 1 only, then disable).

---

### 🚫 The Shower Thought Generator

**What it does**: Asks AI for "random deep thoughts" or "philosophical musings."

**The failure**: Violates predictive model understanding.

Asking a predictive model to be unpredictable is a category error. It will converge on patterns that SOUND deep but follow templates.

**Common outputs**:

- "WHAT IF [X] IS JUST [Y] IN DISGUISE"
- "WE SPEND SO MUCH TIME [A] THAT WE FORGET TO [B]"
- "MAYBE THE REAL [THING] WAS THE [FRIENDS] ALONG THE WAY"

**Why it feels profound**: These patterns trigger recognition, not insight.

**How to fix**: Inject a TOPIC dictionary. Don't ask for "a deep thought"—ask for "a thought about {{topic}}" where topic is randomly selected from 100+ options.

---

### 🚫 The Generic Motivational Generator

**What it does**: Produces uplifting messages like "BELIEVE IN YOURSELF" or "YOU'VE GOT THIS."

**The failure**: Violates the Stop Test and Saccharine Slop principles.

This content could appear anywhere. It has no edge, no personality, no reason to stop and read.

**Common outputs**:

- "TODAY IS FULL OF POSSIBILITIES"
- "YOUR POTENTIAL IS LIMITLESS"
- "EVERY DAY IS A NEW BEGINNING"

**Why people walk past**: This is wallpaper. It's so generic it becomes invisible.

**How to fix**:

1. Add edge via personality dimensions (`{{mood}}` = CHAOTIC)
2. Inject specific topics (`{{theme}}` = "Monday morning meetings")
3. Require subversion ("motivational but with a twist")
4. Reference current obsession for specificity

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

## Constraint Rules (Single Source of Truth)

**CRITICAL**: Display constraints must be defined in ONE place only - the system prompt.

### What Belongs Where

| Constraint Type             | Location           | Reason                         |
| --------------------------- | ------------------ | ------------------------------ |
| Character limits (maxChars) | System prompt ONLY | Hardware constraint, universal |
| Line limits (maxLines)      | System prompt ONLY | Display layout, universal      |
| Approved character set      | System prompt ONLY | Hardware limitation            |
| Forbidden characters        | System prompt ONLY | Causes display errors          |

### User Prompts Must NOT Include

- "Maximum X characters per line"
- "X rows available"
- "132 characters total"
- "6 rows x 22 columns"
- Any character set definitions
- "VESTABOARD CONSTRAINTS" sections
- Display hardware limitations

### Why This Matters

When constraints appear in BOTH system and user prompts:

1. Values may conflict (e.g., framed vs full screen dimensions)
2. AI gets confused about which to follow
3. Production failures increase

The system prompt already defines constraints via `{{maxChars}}` and `{{maxLines}}` template variables which are substituted with the correct values for the generator's mode.

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

### Pre-Flight Question (Ask First!)

**The 100-Output Test**: If I ran this generator 100 times, would I get meaningfully different content each time?

- If NO → Stop. Redesign with variability sources before proceeding.
- If MAYBE → Identify your variability source and document it.
- If YES → Continue with checklist.

### Content Completeness

- [ ] **Self-contained meaning**: Content makes sense with zero external context
- [ ] **Proper ending**: Jokes have punchlines, thoughts have landings
- [ ] **Emotional resolution**: No trailing off or incomplete ideas
- [ ] **Visual completion**: Format-critical types have required elements (see Format-Critical Content Types)

### Repeatability (Variability Check)

- [ ] **Variability source identified**: External data, style dictionary, theme dictionary, or combination
- [ ] **Not relying on date/time alone**: These provide minimal variation
- [ ] **Not relying on personality alone**: Helpful but insufficient as sole source
- [ ] **Avoids Countdown pattern**: Single variable data isn't enough
- [ ] **Avoids Shower Thought pattern**: Not asking AI to "be random"

### Accessibility (Standalone Check)

- [ ] **Standalone test passed**: Content works with zero context
- [ ] **Niche-with-context rule**: Any niche references are self-explanatory
- [ ] **No insider knowledge required**: Stranger walking by would get it
- [ ] **References labeled if obscure**: Source identified when needed

### Prompt Content

- [ ] **Line width**: Every line respects `{{maxChars}}` limit (21 framed, 22 full screen)
- [ ] **UPPERCASE only**: No lowercase letters anywhere
- [ ] **Approved chars**: Only A-Z, 0-9, color emoji, approved punctuation
- [ ] **No word wrapping**: Words never split across lines
- [ ] **Row count**: Content is within `{{maxLines}}` limit (5 framed, 6 full screen)
- [ ] **No meta-talk**: Prompt doesn't ask AI to acknowledge the request
- [ ] **No constraint duplication**: User prompt does NOT repeat Vestaboard constraints from system prompt

### Tone & Voice

- [ ] **Humor priority**: Is this content type supposed to be funny? (Check decision table)
- [ ] **Stop test passed**: Would someone actually stop to read this?
- [ ] **Not saccharine**: Avoids generic positivity, preachy advice, AI-slop
- [ ] **Has personality**: Feels like Houseboy wrote it, not a committee
- [ ] **Appropriate edge**: R-rated language fits the context (if used)
- [ ] **Leverages personality dimensions**: Uses `{{mood}}`, `{{obsession}}` appropriately (amplify or constrain)

### Template Variables

- [ ] **Correct syntax**: `{{variableName}}` with double braces
- [ ] **Defined vars**: All variables are either auto-injected or fetched
- [ ] **No typos**: Variable names match exactly (case-sensitive)
- [ ] **Dictionaries documented**: If using style/theme dictionaries, they're defined in generator

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
GOOD MORNING LAKEWOOD CA  ← 25 chars, exceeds max
```

### Right: Within Limit

```
GOOD MORNING LAKEWOOD   ← 21 chars, fits framed mode
GOOD MORNING LAKEWOOD!  ← 22 chars, fits full screen only
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
