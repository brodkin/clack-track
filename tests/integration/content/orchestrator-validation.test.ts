/**
 * Integration tests for ContentOrchestrator validation
 *
 * Tests that validateGeneratorOutput() is called after generateWithRetry()
 * and that validation failures trigger P3 fallback.
 */

import { ContentOrchestrator } from '@/content/orchestrator';
import { ContentSelector } from '@/content/registry/content-selector';
import { FrameDecorator } from '@/content/frame/frame-decorator';
import { StaticFallbackGenerator } from '@/content/generators/static-fallback-generator';
import type { VestaboardClient } from '@/api/vestaboard/types';
import type { AIProvider } from '@/types/ai';
import type {
  GeneratedContent,
  ContentGenerator,
  GenerationContext,
} from '@/types/content-generator';

describe('ContentOrchestrator - Validation Integration', () => {
  let orchestrator: ContentOrchestrator;
  let mockSelector: jest.Mocked<ContentSelector>;
  let mockDecorator: jest.Mocked<FrameDecorator>;
  let mockVestaboardClient: jest.Mocked<VestaboardClient>;
  let mockFallbackGenerator: jest.Mocked<StaticFallbackGenerator>;
  let mockPreferredProvider: jest.Mocked<AIProvider>;
  let mockAlternateProvider: jest.Mocked<AIProvider>;

  beforeEach(() => {
    // Setup mocks
    mockSelector = {
      select: jest.fn(),
    } as unknown as jest.Mocked<ContentSelector>;

    mockDecorator = {
      decorate: jest.fn().mockResolvedValue({
        layout: Array(6).fill(Array(22).fill(0)),
        metadata: { hasFrame: true },
      }),
    } as unknown as jest.Mocked<FrameDecorator>;

    mockVestaboardClient = {
      sendLayout: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<VestaboardClient>;

    mockFallbackGenerator = {
      generate: jest.fn().mockResolvedValue({
        text: 'FALLBACK CONTENT',
        outputMode: 'text' as const,
      }),
    } as unknown as jest.Mocked<StaticFallbackGenerator>;

    mockPreferredProvider = {} as jest.Mocked<AIProvider>;
    mockAlternateProvider = {} as jest.Mocked<AIProvider>;

    orchestrator = new ContentOrchestrator({
      selector: mockSelector,
      decorator: mockDecorator,
      vestaboardClient: mockVestaboardClient,
      fallbackGenerator: mockFallbackGenerator,
      preferredProvider: mockPreferredProvider,
      alternateProvider: mockAlternateProvider,
    });
  });

  describe('validation of valid content', () => {
    it('should pass valid text content through without errors', async () => {
      // ARRANGE - Valid content (5 lines, 21 chars max)
      const validContent: GeneratedContent = {
        text: 'SHORT LINE\nANOTHER SHORT LINE\nTHIRD LINE\nFOURTH LINE\nFIFTH LINE',
        outputMode: 'text',
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(validContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'test-generator',
          name: 'Test Generator',
          priority: 2,
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - Should complete without fallback
      expect(mockGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockFallbackGenerator.generate).not.toHaveBeenCalled();
      expect(mockDecorator.decorate).toHaveBeenCalled();
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });

    it('should pass valid layout content through without errors', async () => {
      // ARRANGE - Valid layout (6 rows, 22 chars each)
      const validContent: GeneratedContent = {
        text: '',
        outputMode: 'layout',
        layout: {
          rows: [
            'LINE ONE              ',
            'LINE TWO              ',
            'LINE THREE            ',
            'LINE FOUR             ',
            'LINE FIVE             ',
            'LINE SIX              ',
          ],
          characterCodes: Array(6).fill(Array(22).fill(0)),
        },
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(validContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'test-generator',
          name: 'Test Generator',
          priority: 2,
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - Should complete without fallback
      expect(mockGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockFallbackGenerator.generate).not.toHaveBeenCalled();
      expect(mockDecorator.decorate).not.toHaveBeenCalled(); // Layout mode skips decoration
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });
  });

  describe('validation of invalid content - triggers P3 fallback', () => {
    it('should trigger P3 fallback when text content has too many lines (>5)', async () => {
      // ARRANGE - Invalid content (6 lines, exceeds limit of 5)
      const invalidContent: GeneratedContent = {
        text: 'LINE ONE\nLINE TWO\nLINE THREE\nLINE FOUR\nLINE FIVE\nLINE SIX',
        outputMode: 'text',
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(invalidContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'test-generator',
          name: 'Test Generator',
          priority: 2,
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - Should trigger P3 fallback
      expect(mockGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockFallbackGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });

    it('should trigger P3 fallback when text content has line too long (>21 chars)', async () => {
      // ARRANGE - Invalid content (line exceeds 21 chars AND wraps to >5 lines)
      // Pre-validation wrapping salvages slightly long lines, but fails if result >5 lines
      const invalidContent: GeneratedContent = {
        text: 'L1\nL2\nL3\nL4\nTHIS LINE IS WAY TOO LONG FOR VESTABOARD FRAMED MODE AND WILL WRAP',
        outputMode: 'text',
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(invalidContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'test-generator',
          name: 'Test Generator',
          priority: 2,
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - Should trigger P3 fallback
      expect(mockGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockFallbackGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });

    it('should trigger P3 fallback when text content has invalid characters', async () => {
      // ARRANGE - Invalid content (contains trademark symbol which is not a strippable emoji)
      // Note: Emojis like 🎉 are now stripped before validation, so we use ™ which is preserved
      const invalidContent: GeneratedContent = {
        text: 'HELLO™ WORLD',
        outputMode: 'text',
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(invalidContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'test-generator',
          name: 'Test Generator',
          priority: 2,
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - Should trigger P3 fallback
      expect(mockGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockFallbackGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });

    it('should trigger P3 fallback when layout content has wrong number of rows', async () => {
      // ARRANGE - Invalid layout (only 5 rows instead of 6)
      const invalidContent: GeneratedContent = {
        text: '',
        outputMode: 'layout',
        layout: {
          rows: [
            'LINE ONE              ',
            'LINE TWO              ',
            'LINE THREE            ',
            'LINE FOUR             ',
            'LINE FIVE             ',
          ],
          characterCodes: Array(5).fill(Array(22).fill(0)),
        },
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(invalidContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'test-generator',
          name: 'Test Generator',
          priority: 2,
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - Should trigger P3 fallback
      expect(mockGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockFallbackGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });

    it('should trigger P3 fallback when text content is empty', async () => {
      // ARRANGE - Invalid content (empty text)
      const invalidContent: GeneratedContent = {
        text: '',
        outputMode: 'text',
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(invalidContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'test-generator',
          name: 'Test Generator',
          priority: 2,
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - Should trigger P3 fallback
      expect(mockGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockFallbackGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });
  });

  describe('validation error handling', () => {
    it('should catch ContentValidationError and trigger fallback', async () => {
      // ARRANGE - Generator that returns invalid content
      const invalidContent: GeneratedContent = {
        text: 'LINE 1\nLINE 2\nLINE 3\nLINE 4\nLINE 5\nLINE 6\nLINE 7', // 7 lines
        outputMode: 'text',
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(invalidContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'test-generator',
          name: 'Test Generator',
          priority: 2,
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // SPY on console.warn to verify error logging
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT
      expect(mockFallbackGenerator.generate).toHaveBeenCalledWith(context);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test Generator'),
        expect.stringContaining('text mode content must have at most 5 lines')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('formatOptions wiring through pipeline', () => {
    it('should pass formatOptions from registration to decorator for text content', async () => {
      // ARRANGE - Generator with formatOptions in registration
      const validContent: GeneratedContent = {
        text: 'CENTERED MESSAGE',
        outputMode: 'text',
      };

      const formatOptions = {
        textAlign: 'center' as const,
        wordWrap: true,
        maxLines: 4,
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(validContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'centered-generator',
          name: 'Centered Generator',
          priority: 2,
          formatOptions, // Format options in registration
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - formatOptions should be passed as fourth argument to decorator.decorate()
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'CENTERED MESSAGE',
        context.timestamp,
        undefined, // contentData
        formatOptions // formatOptions from registration
      );
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });

    it('should pass undefined formatOptions when registration has no formatOptions', async () => {
      // ARRANGE - Generator without formatOptions
      const validContent: GeneratedContent = {
        text: 'DEFAULT MESSAGE',
        outputMode: 'text',
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(validContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'default-generator',
          name: 'Default Generator',
          priority: 2,
          // No formatOptions
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - formatOptions should be undefined
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'DEFAULT MESSAGE',
        context.timestamp,
        undefined, // contentData
        undefined // formatOptions (not in registration)
      );
    });

    it('should not pass formatOptions to decorator when outputMode is layout', async () => {
      // ARRANGE - Layout mode bypasses decorator entirely
      const layoutContent: GeneratedContent = {
        text: '',
        outputMode: 'layout',
        layout: {
          rows: Array(6).fill('ROW CONTENT            '),
          characterCodes: Array(6).fill(Array(22).fill(0)),
        },
      };

      const formatOptions = {
        textAlign: 'right' as const,
        wordWrap: false,
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(layoutContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'layout-generator',
          name: 'Layout Generator',
          priority: 2,
          formatOptions, // Has formatOptions but should be ignored
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - decorator should not be called for layout mode
      expect(mockDecorator.decorate).not.toHaveBeenCalled();
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });

    it('should preserve formatOptions through P3 fallback path', async () => {
      // ARRANGE - Invalid content triggers fallback, but formatOptions should still be used
      const invalidContent: GeneratedContent = {
        text: 'L1\nL2\nL3\nL4\nL5\nL6\nL7', // Too many lines - triggers fallback
        outputMode: 'text',
      };

      const formatOptions = {
        textAlign: 'left' as const,
        maxCharsPerLine: 18,
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(invalidContent),
      };

      mockSelector.select.mockReturnValue({
        registration: {
          id: 'failing-generator',
          name: 'Failing Generator',
          priority: 2,
          formatOptions,
        },
        generator: mockGenerator,
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        useToolBasedGeneration: false, // These tests don't test tool-based generation
      };

      // ACT
      await orchestrator.generateAndSend(context);

      // ASSERT - fallback should be triggered
      expect(mockFallbackGenerator.generate).toHaveBeenCalledWith(context);

      // formatOptions from original registration should still be passed to decorator
      // even though we're using fallback content
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'FALLBACK CONTENT',
        context.timestamp,
        undefined,
        formatOptions // Original registration's formatOptions
      );
    });
  });
});
