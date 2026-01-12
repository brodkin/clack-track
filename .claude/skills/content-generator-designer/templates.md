# User Prompt Templates

Ready-to-use templates for creating Vestaboard content prompts.

## Template A: Personality-Only Prompts

Use when the AI generates content purely from its creativity and personality dimensions. No external data needed.

### Pattern

```
[Brief directive - what kind of content to create]

[Optional: Potential topics or themes as bullet points]

[Tone/style guidance - how to make it compelling]
```

### Example A1: Motivational Quote

**File:** `prompts/user/motivational.txt`

```
Create an inspiring motivational message for the day.

Potential topics:
- A powerful quote or original saying
- An earnest affirmation
- A sincere compliment

Make it uplifting and energizing for anyone who reads it.
```

**Generator:** AIPromptGenerator (no override needed)
**Model Tier:** LIGHT

### Example A2: Daily Affirmation

**File:** `prompts/user/affirmation.txt`

```
Create a positive affirmation for self-improvement.

Focus on one of these themes:
- Personal growth and learning
- Self-acceptance and confidence
- Resilience and perseverance
- Gratitude and mindfulness

Make it feel genuine, not corny. Second person ("you") is fine.
```

**Generator:** AIPromptGenerator (no override needed)
**Model Tier:** LIGHT

### Example A3: Dad Joke

**File:** `prompts/user/dad-joke.txt`

```
Tell a classic dad joke that makes people groan.

The joke should:
- Have a setup and punchline
- Be family-friendly
- Work without visual elements

Embrace the cringe. The worse, the better.
```

**Generator:** AIPromptGenerator (no override needed)
**Model Tier:** LIGHT

---

## Template B: Data-Injection Prompts

Use when the AI needs external data (weather, news, sports) to create content.

### Pattern

```
{{dataVariable}}

[Directive - what to do with the data]

[Guidelines on how to handle/present it]
```

### Example B1: Weather Commentary

**File:** `prompts/user/weather-focus.txt`

```
{{weather}}

Make a witty or novel commentary about the weather. Avoid the obvious. DO NOT give a weather report. Your audience already knows the weather condition and temperature.

Use the weather data above directly rather than making assumptions.
```

**Generator:** WeatherGenerator (overrides `generate()` to fetch weather)
**Model Tier:** LIGHT

### Example B2: News Humor

**File:** `prompts/user/news-summary.txt`

```
Pretend you are a late night comic. Select a random current event from the list below, then give your humorous take on it.

Your response must begin with "This just in..."

{{headlines}}
```

**Generator:** NewsGenerator or BaseNewsGenerator (overrides `generate()` to fetch headlines)
**Model Tier:** MEDIUM (complex summarization)

### Example B3: Sports Score

**File:** `prompts/user/sports-score.txt`

```
{{gameData}}

Create an exciting announcement about this game result.

Guidelines:
- Lead with the winner
- Include final score
- Add brief color commentary on the outcome
- Keep energy high for close games, sympathetic for blowouts
```

**Generator:** SportsGenerator (overrides `generate()` to fetch game data)
**Model Tier:** LIGHT

### Example B4: Stock Market

**File:** `prompts/user/stock-market.txt`

```
{{marketData}}

Summarize today's market movement in a punchy, accessible way.

Guidelines:
- Lead with overall direction (up/down)
- Mention notable movers if any
- Use plain language, not jargon
- Match energy to market volatility
```

**Generator:** StockGenerator (overrides `generate()` to fetch market data)
**Model Tier:** MEDIUM

---

## Template C: Event Notification Prompts

Use for P0 priority Home Assistant events. These are NOT prompt files but rather string templates embedded in NotificationGenerator subclasses.

### Pattern

```typescript
protected formatNotification(eventData: Record<string, unknown>): string {
  // Extract relevant fields from eventData
  // Format into display-ready string
  // Return lines within {{maxChars}} × {{maxLines}} limits
}
```

### Example C1: Person Arrived

**Generator:** PersonArrivedNotification

```typescript
protected eventPattern = /^person\.(arrived|home)$/;

protected formatNotification(eventData: Record<string, unknown>): string {
  const personName = ((eventData.entity_id as string)?.split('.')[1] || 'SOMEONE')
    .toUpperCase()
    .replace(/_/g, ' ');

  return `WELCOME HOME\n${personName}!`;
}
```

### Example C2: Door Opened/Closed

**Generator:** DoorNotification

```typescript
protected eventPattern = /^binary_sensor\.(front|back|garage)_door$/;

protected formatNotification(eventData: Record<string, unknown>): string {
  const entityId = eventData.entity_id as string || '';
  const doorName = entityId.split('.')[1]?.replace(/_door$/, '').toUpperCase() || 'DOOR';
  const state = (eventData.new_state as { state?: string })?.state;
  const action = state === 'on' ? 'OPENED' : 'CLOSED';

  return `${doorName} DOOR\n${action}`;
}
```

### Example C3: Temperature Alert

**Generator:** TemperatureAlertNotification

```typescript
protected eventPattern = /^automation\.temperature_alert$/;

protected formatNotification(eventData: Record<string, unknown>): string {
  const temp = (eventData.temperature as number) || 0;
  const unit = (eventData.unit as string) || 'F';
  const location = ((eventData.location as string) || 'INSIDE').toUpperCase();

  if (temp > 85) {
    return `${location} TEMP\n${temp}${unit}\nIT'S HOT!`;
  } else if (temp < 40) {
    return `${location} TEMP\n${temp}${unit}\nBUNDLE UP!`;
  }
  return `${location} TEMP\n${temp}${unit}`;
}
```

---

## Template D: Variability-Driven Prompts

Use when you need to ensure variety WITHOUT external data feeds. These patterns use **dictionaries** of options injected via template variables to guarantee each generation is meaningfully different.

**Key Insight**: LLMs are predictive. The same input produces similar outputs. Dictionaries break this pattern.

### Pattern

```
[Directive that incorporates {{randomVariable}}]

[Guidelines for execution]
```

**Generator requirements:**

1. Define dictionary array in generator class
2. Select random element before calling AI
3. Pass selection via `loadPromptWithVariables()`

### Style Dictionaries

Control HOW the AI delivers content.

**File:** `prompts/user/styled-affirmation.txt`

```
Write an affirmation in the style of: {{style}}

Keep the message genuine and encouraging while matching the style.
```

**Generator Dictionary:**

```typescript
private readonly STYLE_DICTIONARY = [
  'A FORTUNE COOKIE',
  'A SPORTS COACH PEP TALK',
  'A MOVIE TRAILER NARRATOR',
  'A DRAMATIC SOAP OPERA',
  'A NATURE DOCUMENTARY',
  'A GRUMPY OLD MAN WHO MEANS WELL',
  'A VALLEY GIRL',
  'A NOIR DETECTIVE VOICEOVER',
  'A COOKING SHOW HOST',
  'AN OVERLY ENTHUSIASTIC INFOMERCIAL',
];
```

**Sample outputs by style:**

Style: "SPORTS COACH PEP TALK"
→ "GET OUT THERE AND SHOW MONDAY WHO'S BOSS!"

Style: "NOIR DETECTIVE VOICEOVER"
→ "THE DAY WAS YOUNG, AND SO WERE YOUR DREAMS"

Style: "GRUMPY OLD MAN WHO MEANS WELL"
→ "YOU'RE GONNA DO FINE. NOW GET MOVING."

### Theme Dictionaries

Control WHAT the AI talks about.

**File:** `prompts/user/themed-observation.txt`

```
Write a clever observation about: {{theme}}

Be specific. Find the unexpected angle. Avoid the obvious take.
```

**Generator Dictionary:**

```typescript
private readonly THEME_DICTIONARY = [
  'COFFEE',
  'COMMUTING',
  'MEETINGS THAT COULD BE EMAILS',
  'PRINTER PROBLEMS',
  'REPLY ALL DISASTERS',
  'LEFTOVER PIZZA FOR BREAKFAST',
  'FORGETTING WHY YOU WALKED INTO A ROOM',
  'THE SNOOZE BUTTON',
  'PARALLEL PARKING',
  'GYM MEMBERSHIPS',
  'LOADING SCREENS',
  'AUTOCORRECT DISASTERS',
  'FINDING PARKING',
];
```

### Combining Style + Theme Dictionaries

Maximum variety comes from combining BOTH dictionaries.

**File:** `prompts/user/styled-observation.txt`

```
Write a {{style}} observation about {{theme}}.

Commit to the style while making the observation genuinely funny or insightful.
```

**Generator Implementation:**

```typescript
protected async generate(context: GenerationContext): Promise<string> {
  const style = this.selectRandom(this.STYLE_DICTIONARY);
  const theme = this.selectRandom(this.THEME_DICTIONARY);

  return this.loadPromptWithVariables({
    style,
    theme,
  });
}
```

**Variety math:** 10 styles × 13 themes = 130 unique combinations. Each combination produces different content.

### Combining with Personality Dimensions

Dictionaries work alongside the system prompt's personality dimensions.

**File:** `prompts/user/obsession-themed.txt`

```
Channel your current {{obsession}} into a {{theme}} observation.

Find the connection between your obsession and the theme, even if it's absurd.
```

**How it works:**

- `{{obsession}}` comes from system prompt (auto-injected, changes weekly)
- `{{theme}}` comes from your theme dictionary (random each generation)

**Example combinations:**

Obsession: "90S MOVIES", Theme: "COFFEE"
→ "YOUR LATTE ORDER IS LIKE TITANIC - OVERLY LONG BUT WORTH IT"

Obsession: "TRUE CRIME", Theme: "MEETINGS"
→ "THIS MEETING HAS LASTED LONGER THAN MOST INVESTIGATIONS"

### Dictionary Guidelines

| Rule               | Why                                     |
| ------------------ | --------------------------------------- |
| Minimum 10 items   | Prevents noticeable repetition          |
| Diverse categories | Ensures genuinely different outputs     |
| Avoid overlaps     | "COFFEE" and "MORNINGS" are too similar |
| Test edge cases    | Ensure all items work with your prompt  |
| All caps           | Match Vestaboard output format          |

### Anti-Pattern: Static Prompts

**❌ WRONG - No variability:**

```
Write a motivational message for the day.
```

This will produce similar content every time. The AI has no reason to vary.

**✅ RIGHT - Dictionary-driven:**

```
Write a {{style}} motivational message about {{theme}}.
```

Now every generation is forced to be different.

---

## Static Fallback Messages

Pre-written messages for P3 fallback when AI fails. These are plain text files, not prompt templates.

### Location

`prompts/static/<category>-<number>.txt`

### Naming Convention

- Use kebab-case category names
- Number sequentially (1, 2, 3...)
- Examples: `food-1.txt`, `tech-2.txt`, `transit-3.txt`

### Example: food-1.txt

```
IS THAT TRUFFLE
OR ARE YOU JUST
HAPPY TO SEE ME
```

### Example: tech-1.txt

```
404
YOUR PATIENCE
NOT FOUND
```

### Example: transit-1.txt

```
TRAINS DON'T RUN
ON YOUR SCHEDULE
SORRY
```

### Guidelines

- **Respect line width limit** (21 chars framed, 22 chars full screen)
- **Respect row limit** (5 rows framed, 6 rows full screen)
- **UPPERCASE only**
- **No template variables** - these are static
- **Standalone humor** - should work without context
- **Category variety** - spread across themes

### Adding New Categories

1. Create `prompts/static/<category>-1.txt`
2. Add at least 3 variants per category
3. StaticFallbackGenerator will automatically pick them up
