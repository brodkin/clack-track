# Generator Patterns

TypeScript scaffolds for creating Vestaboard content generators. Copy-paste ready with correct imports.

## Pattern A: Personality-Only Generator

Simplest pattern. Uses system + user prompts with no data fetching.

### Generator Class

**File:** `src/content/generators/ai/<content-type>-generator.ts`

```typescript
/**
 * <ContentType> Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * <content type description> using AI.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/<content-type>.txt for content guidance
 * - Optimized with <TIER> model tier
 * - Inherits retry logic and provider failover from base class
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates <content type description>
 *
 * Extends AIPromptGenerator with <content-type>-specific prompts
 * and efficient <TIER> model tier selection.
 */
export class <ContentType>Generator extends AIPromptGenerator {
  /**
   * Creates a new <ContentType>Generator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    // Use <TIER> tier for <content type> (reason for tier choice)
    super(promptLoader, modelTierSelector, ModelTier.<TIER>, apiKeys);
  }

  /**
   * Returns the filename for the system prompt
   */
  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  /**
   * Returns the filename for the user prompt
   */
  protected getUserPromptFile(): string {
    return '<content-type>.txt';
  }
}
```

### Registry Entry

Add to `src/content/registry/register-core.ts`:

```typescript
registry.register(
  {
    id: '<content-type>',
    name: '<Content Type> Generator',
    priority: ContentPriority.NORMAL,  // P2
    modelTier: ModelTier.<TIER>,
    applyFrame: true,
  },
  generators.<contentType>
);
```

### Test Template

**File:** `tests/unit/content/generators/<content-type>-generator.test.ts`

```typescript
import { <ContentType>Generator } from '@/content/generators/ai/<content-type>-generator.js';
import { PromptLoader } from '@/content/prompt-loader.js';
import { ModelTierSelector } from '@/api/ai/model-tier-selector.js';

// Mock AI response
jest.mock('@/api/ai/index.js', () => ({
  createAIProvider: jest.fn().mockReturnValue({
    generate: jest.fn().mockResolvedValue({
      text: 'TEST OUTPUT',
      model: 'test-model',
      tokensUsed: 100,
    }),
  }),
  AIProviderType: { OPENAI: 'openai', ANTHROPIC: 'anthropic' },
}));

describe('<ContentType>Generator', () => {
  let generator: <ContentType>Generator;
  let promptLoader: PromptLoader;
  let modelTierSelector: ModelTierSelector;

  beforeEach(() => {
    promptLoader = new PromptLoader();
    modelTierSelector = new ModelTierSelector({
      primaryProvider: 'openai',
      alternateProvider: 'anthropic',
    });

    generator = new <ContentType>Generator(
      promptLoader,
      modelTierSelector,
      { openai: 'test-key', anthropic: 'test-key' }
    );
  });

  describe('validate', () => {
    it('should pass validation when prompt files exist', async () => {
      const result = await generator.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate content successfully', async () => {
      const context = {
        updateType: 'major' as const,
        timestamp: new Date(),
      };

      const result = await generator.generate(context);

      expect(result.text).toBeDefined();
      expect(result.outputMode).toBe('text');
    });
  });
});
```

---

## Pattern B: Data-Injection Generator

Extends generate() to fetch external data and inject into prompts.

### Generator Class

**File:** `src/content/generators/ai/<content-type>-generator.ts`

```typescript
/**
 * <ContentType> Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * <content type description> using AI with real-time data injection.
 *
 * Features:
 * - Fetches data via <DataService> and injects into prompt
 * - Uses prompts/user/<content-type>.txt with {{dataVariable}} template
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector, type ModelSelection } from '../../../api/ai/model-tier-selector.js';
import { createAIProvider, AIProviderType } from '../../../api/ai/index.js';
import { generatePersonalityDimensions } from '../../personality/index.js';
import { <DataService>, type <DataType> } from '../../../services/<data-service>.js';
import type { GenerationContext, GeneratedContent } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';
import type { AIProvider } from '../../../types/ai.js';

export class <ContentType>Generator extends AIPromptGenerator {
  private readonly dataService: <DataService> | null;

  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {},
    dataService?: <DataService>
  ) {
    super(promptLoader, modelTierSelector, ModelTierEnum.<TIER>, apiKeys);
    this.dataService = dataService ?? null;
  }

  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  protected getUserPromptFile(): string {
    return '<content-type>.txt';
  }

  /**
   * Formats data into a string for prompt injection
   */
  private formatDataForPrompt(data: <DataType>): string {
    // Transform raw data into prompt-ready format
    const lines = [
      'DATA:',
      // Add relevant fields...
    ];
    return lines.join('\n');
  }

  /**
   * Generates content with data injection
   *
   * IMPORTANT: Must support promptsOnly flag for tool-based generation.
   * When context.promptsOnly is true, return prompts without making AI call.
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Fetch data (graceful fallback)
    let dataFormatted = 'Data unavailable';
    try {
      if (this.dataService) {
        const data = await this.dataService.getData();
        if (data) {
          dataFormatted = this.formatDataForPrompt(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data for prompt:', error);
    }

    // Step 2: Load system prompt with personality
    const personality = context.personality ?? generatePersonalityDimensions();
    const systemPrompt = await this.promptLoader.loadPromptWithVariables(
      'system',
      this.getSystemPromptFile(),
      {
        mood: personality.mood,
        energyLevel: personality.energyLevel,
        humorStyle: personality.humorStyle,
        obsession: personality.obsession,
        persona: 'Houseboy',
      }
    );

    // Step 3: Load user prompt with data injected
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      { <dataVariable>: dataFormatted }  // e.g., { weather: dataFormatted }
    );

    // Step 3.5: If promptsOnly mode, return prompts without AI call
    // This is required for tool-based generation (ToolBasedGenerator wrapper)
    if (context.promptsOnly) {
      return {
        text: '',
        outputMode: 'text',
        metadata: {
          tier: this.modelTier,
          personality,
          systemPrompt,
          userPrompt,
          dataInjected: dataFormatted !== 'Data unavailable',
        },
      };
    }

    // Step 4: Select model and generate
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);
    let lastError: Error | null = null;

    // Try preferred provider
    try {
      const provider = this.createProvider(selection);
      const response = await provider.generate({ systemPrompt, userPrompt });

      return {
        text: response.text,
        outputMode: 'text',
        metadata: {
          model: response.model,
          tier: this.modelTier,
          provider: selection.provider,
          tokensUsed: response.tokensUsed,
          personality,
          dataInjected: dataFormatted !== 'Data unavailable',
        },
      };
    } catch (error) {
      lastError = error as Error;
    }

    // Try alternate provider
    const alternate = this.modelTierSelector.getAlternate(selection);
    if (alternate) {
      try {
        const alternateProvider = this.createProvider(alternate);
        const response = await alternateProvider.generate({ systemPrompt, userPrompt });

        return {
          text: response.text,
          outputMode: 'text',
          metadata: {
            model: response.model,
            tier: this.modelTier,
            provider: alternate.provider,
            tokensUsed: response.tokensUsed,
            failedOver: true,
            primaryError: lastError?.message,
            personality,
            dataInjected: dataFormatted !== 'Data unavailable',
          },
        };
      } catch (alternateError) {
        lastError = alternateError as Error;
      }
    }

    throw new Error(`All AI providers failed: ${lastError?.message}`);
  }

  /**
   * Creates an AI provider instance for the given selection
   */
  protected createProvider(selection: ModelSelection): AIProvider {
    const apiKey = this['apiKeys'][selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }
    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }
}
```

---

## Pattern C: Event Notification Generator

For P0 priority Home Assistant event responses.

### Generator Class

**File:** `src/content/generators/notifications/<event-type>-notification.ts`

```typescript
/**
 * <EventType> Notification Generator
 *
 * P0 priority notification triggered by Home Assistant <event type> events.
 */

import { NotificationGenerator } from '../notification-generator.js';

/**
 * Generates notifications for <event description>
 *
 * @example
 * Event: { event_type: '<event.pattern>', entity_id: '<entity.id>' }
 * Output: "NOTIFICATION TEXT"
 */
export class <EventType>Notification extends NotificationGenerator {
  /**
   * Pattern to match Home Assistant event types
   */
  protected eventPattern = /^<event\.pattern>$/;

  /**
   * Format notification text from event data
   *
   * @param eventData - Home Assistant event payload
   * @returns Formatted notification text (1-5 lines, 21 chars max each)
   */
  protected formatNotification(eventData: Record<string, unknown>): string {
    // Extract relevant data from event
    const entityId = eventData.entity_id as string || '';
    const entityName = entityId.split('.')[1]?.toUpperCase().replace(/_/g, ' ') || 'UNKNOWN';

    // Format notification lines (max 21 chars each)
    return `NOTIFICATION\n${entityName}`;
  }
}
```

### Registry Entry

Add to `src/content/registry/register-notifications.ts`:

```typescript
import { <EventType>Notification } from '../generators/notifications/<event-type>-notification.js';

export function registerNotifications(registry: ContentRegistry): void {
  registry.register(
    {
      id: '<event-type>-notification',
      name: '<Event Type> Notification',
      priority: ContentPriority.NOTIFICATION,  // P0
      modelTier: ModelTier.LIGHT,  // Not used, but required
      applyFrame: false,  // P0 notifications don't get frame decoration
    },
    new <EventType>Notification()
  );
}
```

### Test Template

**File:** `tests/unit/content/generators/notifications/<event-type>-notification.test.ts`

```typescript
import { <EventType>Notification } from '@/content/generators/notifications/<event-type>-notification.js';

describe('<EventType>Notification', () => {
  let notification: <EventType>Notification;

  beforeEach(() => {
    notification = new <EventType>Notification();
  });

  describe('matchesEvent', () => {
    it('should match valid event types', () => {
      expect(notification.matchesEvent('<event.pattern>')).toBe(true);
    });

    it('should not match invalid event types', () => {
      expect(notification.matchesEvent('other.event')).toBe(false);
    });
  });

  describe('generate', () => {
    it('should format notification correctly', async () => {
      const context = {
        updateType: 'major' as const,
        timestamp: new Date(),
        eventData: {
          event_type: '<event.pattern>',
          entity_id: '<entity.test_entity>',
        },
      };

      const result = await notification.generate(context);

      expect(result.text).toContain('NOTIFICATION');
      expect(result.outputMode).toBe('text');
    });

    it('should enforce 21 char line limit', async () => {
      const context = {
        updateType: 'major' as const,
        timestamp: new Date(),
        eventData: {
          event_type: '<event.pattern>',
          entity_id: '<entity.very_long_entity_name_here>',
        },
      };

      const result = await notification.generate(context);
      const lines = result.text.split('\n');

      lines.forEach(line => {
        expect(line.length).toBeLessThanOrEqual(21);
      });
    });
  });

  describe('validate', () => {
    it('should pass validation', async () => {
      const result = await notification.validate();
      expect(result.valid).toBe(true);
    });
  });
});
```

---

## Pattern D: Programmatic Generator

For generators that create content without AI (patterns, countdowns, ASCII art).

### Generator Class

**File:** `src/content/generators/programmatic/<content-type>-generator.ts`

```typescript
/**
 * <ContentType> Generator
 *
 * Programmatic generator that creates content without AI.
 * Outputs in 'layout' mode with direct character codes.
 */

import { ProgrammaticGenerator } from '../programmatic-generator.js';
import type { GeneratedContent, GenerationContext } from '@/types/content-generator.js';

export class <ContentType>Generator extends ProgrammaticGenerator {
  /**
   * Generate content programmatically (no AI)
   */
  async generate(_context: GenerationContext): Promise<GeneratedContent> {
    // Generate content programmatically
    const patternData = this.createPattern();

    return {
      text: '',
      outputMode: 'layout',
      layout: {
        rows: [],
        characterCodes: patternData,
      },
      metadata: {
        generator: '<content-type>-generator',
      },
    };
  }

  private createPattern(): number[][] {
    // Return 6x22 array of Vestaboard character codes
    // ...
  }
}
```

### Registry Entry (IMPORTANT: useToolBasedGeneration: false)

**Programmatic generators MUST set `useToolBasedGeneration: false`** to avoid being wrapped with ToolBasedGenerator:

```typescript
registry.register(
  {
    id: '<content-type>',
    name: '<Content Type> Generator',
    priority: ContentPriority.NORMAL,
    modelTier: ModelTier.LIGHT,  // Required but not used
    applyFrame: false,  // Programmatic generators control full screen
    useToolBasedGeneration: false,  // REQUIRED: Prevents AI wrapping
  },
  generators.<contentType>
);
```

**Why `useToolBasedGeneration: false` is required:**

Without this flag, the orchestrator wraps the generator with `ToolBasedGenerator`, which:

1. Calls `generate()` with `promptsOnly: true` to extract prompts
2. Programmatic generators have no prompts → empty content
3. AI call fails with "messages must have non-empty content"

---

## Model Tier Selection Guide

| Tier     | Use When                            | Examples                          |
| -------- | ----------------------------------- | --------------------------------- |
| `LIGHT`  | Simple content, personality-driven  | Quotes, affirmations, greetings   |
| `MEDIUM` | Complex reasoning, summarization    | News, data analysis, multi-source |
| `HEAVY`  | Sophisticated reasoning, edge cases | Rarely needed for Vestaboard      |

**Default:** Start with `LIGHT`, upgrade only if quality suffers.

---

## Import Reference

Common imports for generators:

```typescript
// Base classes
import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { ProgrammaticGenerator } from '../programmatic-generator.js';
import { NotificationGenerator } from '../notification-generator.js';

// Infrastructure
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector, type ModelSelection } from '../../../api/ai/model-tier-selector.js';
import { createAIProvider, AIProviderType } from '../../../api/ai/index.js';
import { generatePersonalityDimensions } from '../../personality/index.js';

// Types
import type { GenerationContext, GeneratedContent } from '../../../types/content-generator.js';
import { ModelTier, ContentPriority } from '../../../types/content-generator.js';
import type { AIProvider } from '../../../types/ai.js';

// Data services (examples)
import { WeatherService, type WeatherData } from '../../../services/weather-service.js';
import { RSSFeedClient } from '../../../api/data-sources/rss-feed.js';
```
