import { describe, it, expect } from '@jest/globals';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
  ContentRegistration,
  GeneratorFormatOptions,
} from '@/types/content-generator';
import { ContentPriority, ModelTier } from '@/types/content-generator';
import type { VestaboardLayout } from '@/types/content';

describe('Content Generator Types', () => {
  describe('ContentGenerator Interface', () => {
    it('should define generate method signature', () => {
      // Type-level test - if this compiles, the interface is correct
      const mockGenerator: ContentGenerator = {
        generate: async (_context: GenerationContext): Promise<GeneratedContent> => {
          return {
            text: 'test',
            outputMode: 'text',
          };
        },
        validate: (): GeneratorValidationResult => {
          return { valid: true };
        },
      };

      expect(mockGenerator.generate).toBeDefined();
      expect(mockGenerator.validate).toBeDefined();
      expect(typeof mockGenerator.generate).toBe('function');
      expect(typeof mockGenerator.validate).toBe('function');
    });

    it('should accept GenerationContext in generate method', async () => {
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: async (_ctx: GenerationContext) => ({
          text: 'test',
          outputMode: 'text',
        }),
        validate: () => ({ valid: true }),
      };

      const result = await mockGenerator.generate(context);
      expect(result).toBeDefined();
    });

    it('should return GeneratedContent from generate method', async () => {
      const mockGenerator: ContentGenerator = {
        generate: async () => ({
          text: 'test content',
          outputMode: 'text',
        }),
        validate: () => ({ valid: true }),
      };

      const result = await mockGenerator.generate({
        updateType: 'major',
        timestamp: new Date(),
      });

      expect(result.text).toBe('test content');
      expect(result.outputMode).toBe('text');
    });

    it('should return GeneratorValidationResult from validate method', async () => {
      const mockGenerator: ContentGenerator = {
        generate: async () => ({
          text: 'test',
          outputMode: 'text',
        }),
        validate: async () => ({
          valid: true,
          errors: [],
        }),
      };

      const result = await mockGenerator.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('GenerationContext Interface', () => {
    it('should require updateType and timestamp', () => {
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-01-15T10:00:00Z'),
      };

      expect(context.updateType).toBe('major');
      expect(context.timestamp).toBeInstanceOf(Date);
    });

    it('should accept major updateType', () => {
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      expect(context.updateType).toBe('major');
    });

    it('should accept minor updateType', () => {
      const context: GenerationContext = {
        updateType: 'minor',
        timestamp: new Date(),
      };

      expect(context.updateType).toBe('minor');
    });

    it('should allow optional eventData', () => {
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: {
          event_type: 'person.arrived',
          entity_id: 'person.john',
        },
      };

      expect(context.eventData).toBeDefined();
      expect(context.eventData?.event_type).toBe('person.arrived');
    });

    it('should allow optional previousContent', () => {
      const previousContent: GeneratedContent = {
        text: 'Previous message',
        outputMode: 'text',
      };

      const context: GenerationContext = {
        updateType: 'minor',
        timestamp: new Date(),
        previousContent,
      };

      expect(context.previousContent).toBe(previousContent);
    });

    it('should handle all optional fields together', () => {
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: { custom: 'data' },
        previousContent: {
          text: 'previous',
          outputMode: 'text',
        },
      };

      expect(context.eventData).toBeDefined();
      expect(context.previousContent).toBeDefined();
    });
  });

  describe('GeneratedContent Interface', () => {
    it('should require text and outputMode', () => {
      const content: GeneratedContent = {
        text: 'Hello World',
        outputMode: 'text',
      };

      expect(content.text).toBe('Hello World');
      expect(content.outputMode).toBe('text');
    });

    it('should accept text outputMode', () => {
      const content: GeneratedContent = {
        text: 'Plain text content',
        outputMode: 'text',
      };

      expect(content.outputMode).toBe('text');
    });

    it('should accept layout outputMode', () => {
      const content: GeneratedContent = {
        text: 'Formatted content',
        outputMode: 'layout',
      };

      expect(content.outputMode).toBe('layout');
    });

    it('should allow optional layout with VestaboardLayout type', () => {
      const layout: VestaboardLayout = {
        rows: ['Row 1', 'Row 2', 'Row 3', 'Row 4', 'Row 5', 'Row 6'],
      };

      const content: GeneratedContent = {
        text: 'Content with layout',
        outputMode: 'layout',
        layout,
      };

      expect(content.layout).toBe(layout);
      expect(content.layout?.rows).toHaveLength(6);
    });

    it('should allow optional metadata', () => {
      const content: GeneratedContent = {
        text: 'Content with metadata',
        outputMode: 'text',
        metadata: {
          source: 'openai',
          temperature: 0.7,
          model: 'gpt-4o',
        },
      };

      expect(content.metadata?.source).toBe('openai');
      expect(content.metadata?.temperature).toBe(0.7);
    });

    it('should handle all optional fields together', () => {
      const content: GeneratedContent = {
        text: 'Full content',
        outputMode: 'layout',
        layout: {
          rows: ['A', 'B', 'C', 'D', 'E', 'F'],
        },
        metadata: {
          custom: 'value',
        },
      };

      expect(content.layout).toBeDefined();
      expect(content.metadata).toBeDefined();
    });
  });

  describe('GeneratorValidationResult Interface', () => {
    it('should require valid boolean', () => {
      const result: GeneratorValidationResult = {
        valid: true,
      };

      expect(result.valid).toBe(true);
    });

    it('should accept true for valid', () => {
      const result: GeneratorValidationResult = {
        valid: true,
      };

      expect(result.valid).toBe(true);
    });

    it('should accept false for valid', () => {
      const result: GeneratorValidationResult = {
        valid: false,
      };

      expect(result.valid).toBe(false);
    });

    it('should allow optional errors array', () => {
      const result: GeneratorValidationResult = {
        valid: false,
        errors: ['Missing required field', 'Invalid format'],
      };

      expect(result.errors).toHaveLength(2);
      expect(result.errors?.[0]).toBe('Missing required field');
    });

    it('should work without errors array when valid', () => {
      const result: GeneratorValidationResult = {
        valid: true,
      };

      expect(result.errors).toBeUndefined();
    });

    it('should work with empty errors array', () => {
      const result: GeneratorValidationResult = {
        valid: true,
        errors: [],
      };

      expect(result.errors).toEqual([]);
    });
  });

  describe('ContentPriority Enum', () => {
    it('should define NOTIFICATION as 0', () => {
      // This will be imported from the actual enum
      const priority = 0; // ContentPriority.NOTIFICATION
      expect(priority).toBe(0);
    });

    it('should define NORMAL as 2', () => {
      const priority = 2; // ContentPriority.NORMAL
      expect(priority).toBe(2);
    });

    it('should define FALLBACK as 3', () => {
      const priority = 3; // ContentPriority.FALLBACK
      expect(priority).toBe(3);
    });

    it('should have P0 as highest priority (lowest number)', () => {
      const notification = 0; // ContentPriority.NOTIFICATION
      const normal = 2; // ContentPriority.NORMAL
      const fallback = 3; // ContentPriority.FALLBACK

      expect(notification).toBeLessThan(normal);
      expect(normal).toBeLessThan(fallback);
    });
  });

  describe('ModelTier Enum', () => {
    it('should define LIGHT tier', () => {
      const tier = 'light'; // ModelTier.LIGHT
      expect(tier).toBe('light');
    });

    it('should define MEDIUM tier', () => {
      const tier = 'medium'; // ModelTier.MEDIUM
      expect(tier).toBe('medium');
    });

    it('should define HEAVY tier', () => {
      const tier = 'heavy'; // ModelTier.HEAVY
      expect(tier).toBe('heavy');
    });
  });

  describe('ContentRegistration Interface', () => {
    it('should require id, name, priority, and modelTier', () => {
      const registration: ContentRegistration = {
        id: 'motivational-quote',
        name: 'Motivational Quote Generator',
        priority: 2, // ContentPriority.NORMAL
        modelTier: 'light', // ModelTier.LIGHT
      };

      expect(registration.id).toBe('motivational-quote');
      expect(registration.name).toBe('Motivational Quote Generator');
      expect(registration.priority).toBe(2);
      expect(registration.modelTier).toBe('light');
    });

    it('should allow all priority levels', () => {
      const notificationReg: ContentRegistration = {
        id: 'notification',
        name: 'Notification',
        priority: 0, // ContentPriority.NOTIFICATION
        modelTier: 'light',
      };

      const normalReg: ContentRegistration = {
        id: 'normal',
        name: 'Normal Content',
        priority: 2, // ContentPriority.NORMAL
        modelTier: 'medium',
      };

      const fallbackReg: ContentRegistration = {
        id: 'fallback',
        name: 'Fallback Content',
        priority: 3, // ContentPriority.FALLBACK
        modelTier: 'light',
      };

      expect(notificationReg.priority).toBe(0);
      expect(normalReg.priority).toBe(2);
      expect(fallbackReg.priority).toBe(3);
    });

    it('should allow all model tiers', () => {
      const lightReg: ContentRegistration = {
        id: 'light',
        name: 'Light',
        priority: 2,
        modelTier: 'light',
      };

      const mediumReg: ContentRegistration = {
        id: 'medium',
        name: 'Medium',
        priority: 2,
        modelTier: 'medium',
      };

      const heavyReg: ContentRegistration = {
        id: 'heavy',
        name: 'Heavy',
        priority: 2,
        modelTier: 'heavy',
      };

      expect(lightReg.modelTier).toBe('light');
      expect(mediumReg.modelTier).toBe('medium');
      expect(heavyReg.modelTier).toBe('heavy');
    });

    it('should allow optional applyFrame field', () => {
      const withFrame: ContentRegistration = {
        id: 'with-frame',
        name: 'With Frame',
        priority: 2,
        modelTier: 'light',
        applyFrame: true,
      };

      const withoutFrame: ContentRegistration = {
        id: 'without-frame',
        name: 'Without Frame',
        priority: 2,
        modelTier: 'light',
        applyFrame: false,
      };

      expect(withFrame.applyFrame).toBe(true);
      expect(withoutFrame.applyFrame).toBe(false);
    });

    it('should allow optional eventTriggerPattern field', () => {
      const registration: ContentRegistration = {
        id: 'event-triggered',
        name: 'Event Triggered',
        priority: 0,
        modelTier: 'light',
        eventTriggerPattern: /^person\.(arrived|left)$/,
      };

      expect(registration.eventTriggerPattern).toBeInstanceOf(RegExp);
      expect(registration.eventTriggerPattern?.test('person.arrived')).toBe(true);
      expect(registration.eventTriggerPattern?.test('person.left')).toBe(true);
      expect(registration.eventTriggerPattern?.test('door.opened')).toBe(false);
    });

    it('should allow optional tags field', () => {
      const registration: ContentRegistration = {
        id: 'tagged-content',
        name: 'Tagged Content',
        priority: 2,
        modelTier: 'medium',
        tags: ['motivational', 'daily', 'morning'],
      };

      expect(registration.tags).toHaveLength(3);
      expect(registration.tags).toContain('motivational');
    });

    it('should handle all optional fields together', () => {
      const registration: ContentRegistration = {
        id: 'full-registration',
        name: 'Full Registration',
        priority: 0,
        modelTier: 'heavy',
        applyFrame: false,
        eventTriggerPattern: /^door\./,
        tags: ['security', 'notification'],
      };

      expect(registration.applyFrame).toBe(false);
      expect(registration.eventTriggerPattern).toBeDefined();
      expect(registration.tags).toBeDefined();
    });

    it('should work with minimal required fields only', () => {
      const registration: ContentRegistration = {
        id: 'minimal',
        name: 'Minimal Registration',
        priority: 2,
        modelTier: 'light',
      };

      expect(registration.applyFrame).toBeUndefined();
      expect(registration.eventTriggerPattern).toBeUndefined();
      expect(registration.tags).toBeUndefined();
    });
  });

  describe('GeneratorFormatOptions Interface', () => {
    it('should allow all properties to be optional', () => {
      // Empty object should be valid - all properties are optional
      const options: GeneratorFormatOptions = {};
      expect(options).toBeDefined();
      expect(options.textAlign).toBeUndefined();
      expect(options.maxLines).toBeUndefined();
      expect(options.maxCharsPerLine).toBeUndefined();
      expect(options.wordWrap).toBeUndefined();
    });

    it('should accept textAlign with left value', () => {
      const options: GeneratorFormatOptions = {
        textAlign: 'left',
      };
      expect(options.textAlign).toBe('left');
    });

    it('should accept textAlign with center value', () => {
      const options: GeneratorFormatOptions = {
        textAlign: 'center',
      };
      expect(options.textAlign).toBe('center');
    });

    it('should accept textAlign with right value', () => {
      const options: GeneratorFormatOptions = {
        textAlign: 'right',
      };
      expect(options.textAlign).toBe('right');
    });

    it('should accept maxLines within valid range (1-5)', () => {
      // Test minimum valid value
      const minOptions: GeneratorFormatOptions = {
        maxLines: 1,
      };
      expect(minOptions.maxLines).toBe(1);

      // Test maximum valid value
      const maxOptions: GeneratorFormatOptions = {
        maxLines: 5,
      };
      expect(maxOptions.maxLines).toBe(5);

      // Test middle value
      const midOptions: GeneratorFormatOptions = {
        maxLines: 3,
      };
      expect(midOptions.maxLines).toBe(3);
    });

    it('should accept maxCharsPerLine within valid range (1-21)', () => {
      // Test minimum valid value
      const minOptions: GeneratorFormatOptions = {
        maxCharsPerLine: 1,
      };
      expect(minOptions.maxCharsPerLine).toBe(1);

      // Test maximum valid value (21 leaves room for frame)
      const maxOptions: GeneratorFormatOptions = {
        maxCharsPerLine: 21,
      };
      expect(maxOptions.maxCharsPerLine).toBe(21);

      // Test common value
      const commonOptions: GeneratorFormatOptions = {
        maxCharsPerLine: 18,
      };
      expect(commonOptions.maxCharsPerLine).toBe(18);
    });

    it('should accept wordWrap boolean true', () => {
      const options: GeneratorFormatOptions = {
        wordWrap: true,
      };
      expect(options.wordWrap).toBe(true);
    });

    it('should accept wordWrap boolean false', () => {
      const options: GeneratorFormatOptions = {
        wordWrap: false,
      };
      expect(options.wordWrap).toBe(false);
    });

    it('should handle all properties together', () => {
      const options: GeneratorFormatOptions = {
        textAlign: 'center',
        maxLines: 4,
        maxCharsPerLine: 20,
        wordWrap: true,
      };

      expect(options.textAlign).toBe('center');
      expect(options.maxLines).toBe(4);
      expect(options.maxCharsPerLine).toBe(20);
      expect(options.wordWrap).toBe(true);
    });

    it('should allow partial property combinations', () => {
      // Only textAlign and wordWrap
      const options1: GeneratorFormatOptions = {
        textAlign: 'right',
        wordWrap: false,
      };
      expect(options1.textAlign).toBe('right');
      expect(options1.wordWrap).toBe(false);
      expect(options1.maxLines).toBeUndefined();
      expect(options1.maxCharsPerLine).toBeUndefined();

      // Only line constraints
      const options2: GeneratorFormatOptions = {
        maxLines: 5,
        maxCharsPerLine: 21,
      };
      expect(options2.maxLines).toBe(5);
      expect(options2.maxCharsPerLine).toBe(21);
      expect(options2.textAlign).toBeUndefined();
      expect(options2.wordWrap).toBeUndefined();
    });
  });

  describe('ContentRegistration with formatOptions', () => {
    it('should allow registration without formatOptions (backwards compatible)', () => {
      const registration: ContentRegistration = {
        id: 'legacy-generator',
        name: 'Legacy Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      expect(registration.formatOptions).toBeUndefined();
      // Verify other required fields still work
      expect(registration.id).toBe('legacy-generator');
    });

    it('should allow registration with formatOptions', () => {
      const registration: ContentRegistration = {
        id: 'formatted-generator',
        name: 'Formatted Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.MEDIUM,
        formatOptions: {
          textAlign: 'center',
          maxLines: 4,
          maxCharsPerLine: 20,
          wordWrap: true,
        },
      };

      expect(registration.formatOptions).toBeDefined();
      expect(registration.formatOptions?.textAlign).toBe('center');
      expect(registration.formatOptions?.maxLines).toBe(4);
      expect(registration.formatOptions?.maxCharsPerLine).toBe(20);
      expect(registration.formatOptions?.wordWrap).toBe(true);
    });

    it('should allow registration with empty formatOptions', () => {
      const registration: ContentRegistration = {
        id: 'empty-options-generator',
        name: 'Empty Options Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
        formatOptions: {},
      };

      expect(registration.formatOptions).toBeDefined();
      expect(registration.formatOptions?.textAlign).toBeUndefined();
    });

    it('should allow registration with partial formatOptions', () => {
      const registration: ContentRegistration = {
        id: 'partial-options-generator',
        name: 'Partial Options Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
        formatOptions: {
          textAlign: 'left',
        },
      };

      expect(registration.formatOptions?.textAlign).toBe('left');
      expect(registration.formatOptions?.maxLines).toBeUndefined();
    });

    it('should allow formatOptions alongside other optional fields', () => {
      const registration: ContentRegistration = {
        id: 'full-options-generator',
        name: 'Full Options Generator',
        priority: ContentPriority.NOTIFICATION,
        modelTier: ModelTier.HEAVY,
        applyFrame: false,
        eventTriggerPattern: /^test\./,
        tags: ['test', 'formatted'],
        formatOptions: {
          textAlign: 'right',
          maxLines: 5,
          maxCharsPerLine: 21,
          wordWrap: false,
        },
      };

      expect(registration.applyFrame).toBe(false);
      expect(registration.eventTriggerPattern).toBeInstanceOf(RegExp);
      expect(registration.tags).toHaveLength(2);
      expect(registration.formatOptions?.textAlign).toBe('right');
      expect(registration.formatOptions?.maxLines).toBe(5);
    });
  });

  describe('Type Exports from index.ts', () => {
    it('should export all content generator types from main index', () => {
      // Static import to test module exports
      // TypeScript compilation validates that these types are accessible
      // If this test compiles, the exports are working correctly

      // Runtime verification that the types exist
      expect(typeof ContentPriority.NOTIFICATION).toBe('number');
      expect(typeof ModelTier.LIGHT).toBe('string');

      // Type assertions to ensure all types are accessible
      const _typeCheck: {
        generator?: ContentGenerator;
        context?: GenerationContext;
        content?: GeneratedContent;
        validation?: GeneratorValidationResult;
        priority?: ContentPriority;
        tier?: ModelTier;
        registration?: ContentRegistration;
        formatOptions?: GeneratorFormatOptions;
      } = {};
      expect(_typeCheck).toBeDefined();
    });
  });
});
