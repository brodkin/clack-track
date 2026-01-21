/**
 * Unit Tests for ContentOrchestrator
 *
 * Tests the main pipeline coordinating selection, generation, retry,
 * P3 failover, frame decoration, and content caching.
 */

import { ContentOrchestrator } from '@/content/orchestrator';
import { ContentSelector } from '@/content/registry/content-selector';
import { FrameDecorator } from '@/content/frame/frame-decorator';
import { StaticFallbackGenerator } from '@/content/generators/static-fallback-generator';
import { RateLimitError, AuthenticationError, ContentValidationError } from '@/types/errors';
import type { VestaboardClient } from '@/api/vestaboard/types';
import type { AIProvider } from '@/types/ai';
import {
  ModelTier,
  type ContentGenerator,
  type GenerationContext,
  type GeneratedContent,
} from '@/types/content-generator';
import type { RegisteredGenerator } from '@/content/registry/content-registry';
import type { ContentRepository } from '@/storage/repositories/content-repo';
import type { CircuitBreakerService } from '@/services/circuit-breaker-service';

// Mock dependencies
jest.mock('@/content/orchestrator-retry', () => ({
  generateWithRetry: jest.fn(),
}));

jest.mock('@/utils/validators', () => ({
  validateGeneratorOutput: jest.fn(),
}));

const { generateWithRetry } = jest.requireMock('@/content/orchestrator-retry');
const { validateGeneratorOutput: mockValidateGeneratorOutput } =
  jest.requireMock('@/utils/validators');

describe('ContentOrchestrator', () => {
  let mockSelector: jest.Mocked<ContentSelector>;
  let mockDecorator: jest.Mocked<FrameDecorator>;
  let mockVestaboardClient: jest.Mocked<VestaboardClient>;
  let mockFallbackGenerator: jest.Mocked<StaticFallbackGenerator>;
  let mockPreferredProvider: jest.Mocked<AIProvider>;
  let mockAlternateProvider: jest.Mocked<AIProvider>;
  let mockContentRepository: jest.Mocked<ContentRepository>;
  let orchestrator: ContentOrchestrator;

  beforeEach(() => {
    // Create mocked dependencies
    mockSelector = {
      select: jest.fn(),
    } as unknown as jest.Mocked<ContentSelector>;

    mockDecorator = {
      decorate: jest.fn(),
    } as unknown as jest.Mocked<FrameDecorator>;

    mockVestaboardClient = {
      sendText: jest.fn().mockResolvedValue(undefined),
      sendLayout: jest.fn().mockResolvedValue(undefined),
      sendLayoutWithAnimation: jest.fn().mockResolvedValue(undefined),
      readMessage: jest.fn().mockResolvedValue([]),
      validateConnection: jest.fn().mockResolvedValue({ connected: true }),
    };

    mockFallbackGenerator = {
      generate: jest.fn(),
      validate: jest.fn().mockReturnValue({ valid: true }),
    } as unknown as jest.Mocked<StaticFallbackGenerator>;

    mockPreferredProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn().mockResolvedValue(true),
    };

    mockAlternateProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn().mockResolvedValue(true),
    };

    mockContentRepository = {
      saveContent: jest.fn().mockResolvedValue({ id: 1 }),
      getLatestContent: jest.fn(),
      getContentHistory: jest.fn(),
    } as unknown as jest.Mocked<ContentRepository>;

    // Reset mocks
    jest.clearAllMocks();
    mockValidateGeneratorOutput.mockImplementation(() => undefined);

    // Create orchestrator instance
    orchestrator = new ContentOrchestrator({
      selector: mockSelector,
      decorator: mockDecorator,
      vestaboardClient: mockVestaboardClient,
      fallbackGenerator: mockFallbackGenerator,
      preferredProvider: mockPreferredProvider,
      alternateProvider: mockAlternateProvider,
      contentRepository: mockContentRepository,
    });
  });

  describe('constructor', () => {
    it('should accept all required dependencies', () => {
      expect(orchestrator).toBeInstanceOf(ContentOrchestrator);
    });
  });

  describe('generateAndSend - Happy Path', () => {
    it('should select generator, generate content, decorate, cache, and send', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'test-gen',
          name: 'Test Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        generator: mockGenerator,
      };

      const generatedContent: GeneratedContent = {
        text: 'TEST CONTENT',
        outputMode: 'text',
      };

      const decoratedLayout = [[1, 2, 3]];

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: decoratedLayout,
        warnings: [],
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert
      expect(mockSelector.select).toHaveBeenCalledWith(context);

      // Verify generateWithRetry was called with a factory function
      expect(generateWithRetry).toHaveBeenCalledTimes(1);
      const factoryCall = (generateWithRetry as jest.Mock).mock.calls[0];
      expect(factoryCall[0]).toBeInstanceOf(Function); // First arg is factory
      expect(factoryCall[1]).toEqual(context);
      expect(factoryCall[2]).toBe(mockPreferredProvider);
      expect(factoryCall[3]).toBe(mockAlternateProvider);

      // Verify factory creates ToolBasedGenerator wrapper (default behavior)
      const factory = factoryCall[0];
      const createdGenerator = factory(mockPreferredProvider);
      // Tool-based generation is now the default, so generator is wrapped
      expect(createdGenerator).toHaveProperty('baseGenerator', mockGenerator);
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'TEST CONTENT',
        context.timestamp,
        undefined,
        undefined // formatOptions (not specified in registration)
      );
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledWith(decoratedLayout);

      // Verify cached content
      const cached = orchestrator.getCachedContent();
      expect(cached).toEqual(generatedContent);
    });

    it('should skip decoration when outputMode is layout', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'test-gen',
          name: 'Test Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        generator: mockGenerator,
      };

      const preFormattedCharacterCodes = Array(6)
        .fill(null)
        .map(() => Array(22).fill(0));

      const generatedContent: GeneratedContent = {
        text: '',
        outputMode: 'layout',
        layout: {
          rows: [
            'ROW ONE               ',
            'ROW TWO               ',
            'ROW THREE             ',
            'ROW FOUR              ',
            'ROW FIVE              ',
            'ROW SIX               ',
          ],
          characterCodes: preFormattedCharacterCodes,
        },
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);

      // Act
      await orchestrator.generateAndSend(context);

      // Assert
      expect(mockDecorator.decorate).not.toHaveBeenCalled();
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledWith(preFormattedCharacterCodes);

      // Verify cached content
      const cached = orchestrator.getCachedContent();
      expect(cached).toEqual(generatedContent);
    });
  });

  describe('generateAndSend - Retry Scenarios', () => {
    it('should use retry logic with alternate provider on RateLimitError', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'test-gen',
          name: 'Test Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        generator: mockGenerator,
      };

      const generatedContent: GeneratedContent = {
        text: 'ALTERNATE PROVIDER',
        outputMode: 'text',
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);

      const decoratedLayout = [[1, 2, 3]];
      mockDecorator.decorate.mockResolvedValue({
        layout: decoratedLayout,
        warnings: [],
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert
      // Verify generateWithRetry was called with a factory function
      expect(generateWithRetry).toHaveBeenCalledTimes(1);
      const factoryCall = (generateWithRetry as jest.Mock).mock.calls[0];
      expect(factoryCall[0]).toBeInstanceOf(Function); // First arg is factory
      expect(factoryCall[1]).toEqual(context);
      expect(factoryCall[2]).toBe(mockPreferredProvider);
      expect(factoryCall[3]).toBe(mockAlternateProvider);

      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledWith(decoratedLayout);

      // Verify cached content
      const cached = orchestrator.getCachedContent();
      expect(cached).toEqual(generatedContent);
    });
  });

  describe('generateAndSend - P3 Fallback', () => {
    it('should fall back to StaticFallbackGenerator when retry fails', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'test-gen',
          name: 'Test Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        generator: mockGenerator,
      };

      const fallbackContent: GeneratedContent = {
        text: 'Static fallback content',
        outputMode: 'text',
        metadata: {
          source: 'static-fallback',
        },
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockRejectedValue(
        new RateLimitError('Both providers rate limited')
      );
      mockFallbackGenerator.generate.mockResolvedValue(fallbackContent);

      const decoratedLayout = [[7, 8, 9]];
      mockDecorator.decorate.mockResolvedValue({
        layout: decoratedLayout,
        warnings: [],
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert
      expect(generateWithRetry).toHaveBeenCalled();
      expect(mockFallbackGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'Static fallback content',
        context.timestamp,
        undefined,
        undefined // formatOptions (not specified in registration)
      );
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledWith(decoratedLayout);

      // Verify cached content is fallback
      const cached = orchestrator.getCachedContent();
      expect(cached).toEqual(fallbackContent);
    });

    it('should handle fallback with pre-formatted layout', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'test-gen',
          name: 'Test Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        generator: mockGenerator,
      };

      const fallbackCharacterCodes = [[1, 2, 3]];
      const fallbackContent: GeneratedContent = {
        text: 'Static fallback content',
        outputMode: 'layout',
        layout: {
          rows: ['ABC'],
          characterCodes: fallbackCharacterCodes,
        },
        metadata: {
          source: 'static-fallback',
        },
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockRejectedValue(new AuthenticationError('Auth failed'));
      mockFallbackGenerator.generate.mockResolvedValue(fallbackContent);

      // Act
      await orchestrator.generateAndSend(context);

      // Assert
      expect(mockFallbackGenerator.generate).toHaveBeenCalledWith(context);
      expect(mockDecorator.decorate).not.toHaveBeenCalled();
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledWith(fallbackCharacterCodes);

      // Verify cached content
      const cached = orchestrator.getCachedContent();
      expect(cached).toEqual(fallbackContent);
    });

    it('should log generator name and id when P3 fallback triggers', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'weather-focus',
          name: 'Weather Forecast',
          priority: 2,
          modelTier: ModelTier.MEDIUM,
          applyFrame: true,
        },
        generator: mockGenerator,
      };

      const fallbackContent: GeneratedContent = {
        text: 'Static fallback content',
        outputMode: 'text',
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockRejectedValue(new RateLimitError('Rate limit exceeded'));
      mockFallbackGenerator.generate.mockResolvedValue(fallbackContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      // Spy on console.warn
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      await orchestrator.generateAndSend(context);

      // Assert - console.warn should include generator name and id
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Weather Forecast'),
        expect.any(String)
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('weather-focus'),
        expect.any(String)
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('P3 fallback'),
        expect.any(String)
      );

      // Cleanup
      warnSpy.mockRestore();
    });
  });

  describe('generateAndSend - Error Handling', () => {
    it('should throw error when VestaboardClient fails', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'test-gen',
          name: 'Test Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        generator: mockGenerator,
      };

      const generatedContent: GeneratedContent = {
        text: 'TEST CONTENT',
        outputMode: 'text',
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      const vestaboardError = new Error('Network error');
      mockVestaboardClient.sendLayout.mockRejectedValue(vestaboardError);

      // Act & Assert
      await expect(orchestrator.generateAndSend(context)).rejects.toThrow('Network error');
    });

    it('should throw error when selector returns null', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      mockSelector.select.mockReturnValue(null);

      // Act & Assert
      await expect(orchestrator.generateAndSend(context)).rejects.toThrow(
        'No content generator available for context'
      );
    });
  });

  describe('getCachedContent', () => {
    it('should return null when no content has been cached', () => {
      // Act
      const cached = orchestrator.getCachedContent();

      // Assert
      expect(cached).toBeNull();
    });

    it('should return cached content after successful generation', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'test-gen',
          name: 'Test Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        generator: mockGenerator,
      };

      const generatedContent: GeneratedContent = {
        text: 'CACHED CONTENT',
        outputMode: 'text',
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      // Act
      await orchestrator.generateAndSend(context);
      const cached = orchestrator.getCachedContent();

      // Assert
      expect(cached).toEqual(generatedContent);
    });

    it('should update cache on subsequent successful generations', async () => {
      // Arrange
      const context1: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const context2: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'test-gen',
          name: 'Test Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        generator: mockGenerator,
      };

      const content1: GeneratedContent = {
        text: 'FIRST CONTENT',
        outputMode: 'text',
      };

      const content2: GeneratedContent = {
        text: 'SECOND CONTENT',
        outputMode: 'text',
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock)
        .mockResolvedValueOnce(content1)
        .mockResolvedValueOnce(content2);
      mockDecorator.decorate.mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      // Act
      await orchestrator.generateAndSend(context1);
      const cached1 = orchestrator.getCachedContent();

      await orchestrator.generateAndSend(context2);
      const cached2 = orchestrator.getCachedContent();

      // Assert
      expect(cached1).toEqual(content1);
      expect(cached2).toEqual(content2);
    });
  });

  describe('clearCache', () => {
    it('should clear cached content', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'test-gen',
          name: 'Test Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        generator: mockGenerator,
      };

      const generatedContent: GeneratedContent = {
        text: 'CACHED CONTENT',
        outputMode: 'text',
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      // Act
      await orchestrator.generateAndSend(context);
      expect(orchestrator.getCachedContent()).toEqual(generatedContent);

      orchestrator.clearCache();
      const cached = orchestrator.getCachedContent();

      // Assert
      expect(cached).toBeNull();
    });
  });

  describe('Database Persistence', () => {
    describe('Successful Major Updates', () => {
      it('should save content to database on successful major update', async () => {
        // Arrange
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T10:30:00Z'),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'motivational',
            name: 'Motivational Quote',
            priority: 2,
            modelTier: ModelTier.LIGHT,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const generatedContent: GeneratedContent = {
          text: 'SUCCESS CONTENT',
          outputMode: 'text',
          metadata: {
            provider: 'openai',
            model: 'gpt-4.1-nano',
            tier: 'LIGHT',
            tokensUsed: 150,
            failedOver: false,
          },
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act
        await orchestrator.generateAndSend(context);

        // Wait for fire-and-forget promise
        await new Promise(resolve => setImmediate(resolve));

        // Assert
        expect(mockContentRepository.saveContent).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'SUCCESS CONTENT',
            type: 'major',
            generatedAt: context.timestamp,
            sentAt: expect.any(Date),
            status: 'success',
            generatorId: 'motivational',
            generatorName: 'Motivational Quote',
            priority: 2,
            aiProvider: 'openai',
            aiModel: 'gpt-4.1-nano',
            modelTier: 'LIGHT',
            tokensUsed: 150,
            failedOver: false,
          })
        );
      });

      it('should save content with failover metadata when cross-provider failover occurred', async () => {
        // Arrange
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T10:30:00Z'),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'weather',
            name: 'Weather',
            priority: 2,
            modelTier: ModelTier.MEDIUM,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const generatedContent: GeneratedContent = {
          text: 'WEATHER CONTENT',
          outputMode: 'text',
          metadata: {
            provider: 'anthropic',
            model: 'claude-sonnet-4.5',
            tier: 'MEDIUM',
            tokensUsed: 320,
            failedOver: true,
            primaryProvider: 'openai',
            primaryError: 'Rate limit exceeded',
          },
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act
        await orchestrator.generateAndSend(context);

        // Wait for fire-and-forget promise
        await new Promise(resolve => setImmediate(resolve));

        // Assert
        expect(mockContentRepository.saveContent).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'WEATHER CONTENT',
            status: 'success',
            aiProvider: 'anthropic',
            aiModel: 'claude-sonnet-4.5',
            modelTier: 'MEDIUM',
            tokensUsed: 320,
            failedOver: true,
            primaryProvider: 'openai',
            primaryError: 'Rate limit exceeded',
          })
        );
      });
    });

    describe('Failed Generations', () => {
      it('should save text and metadata on validation failure', async () => {
        // Arrange
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T10:30:00Z'),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'quote-gen',
            name: 'Quote Generator',
            priority: 2,
            modelTier: ModelTier.LIGHT,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        // Content that fails validation
        const generatedContent: GeneratedContent = {
          text: 'LINE ONE\nLINE TWO\nLINE THREE\nLINE FOUR\nLINE FIVE\nLINE SIX\nLINE SEVEN',
          outputMode: 'text',
          metadata: {
            provider: 'openai',
            model: 'gpt-4.1-nano',
            tier: 'LIGHT',
            tokensUsed: 250,
            failedOver: false,
          },
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);

        // Mock validation to throw ContentValidationError
        mockValidateGeneratorOutput.mockImplementation(() => {
          throw new ContentValidationError('Content exceeds 6 lines');
        });

        const fallbackContent: GeneratedContent = {
          text: 'Static fallback content',
          outputMode: 'text',
        };

        mockFallbackGenerator.generate.mockResolvedValue(fallbackContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act
        await orchestrator.generateAndSend(context);

        // Wait for fire-and-forget promise
        await new Promise(resolve => setImmediate(resolve));

        // Assert - Should save the generated text and metadata, even though validation failed
        expect(mockContentRepository.saveContent).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'LINE ONE\nLINE TWO\nLINE THREE\nLINE FOUR\nLINE FIVE\nLINE SIX\nLINE SEVEN',
            status: 'failed',
            generatorId: 'quote-gen',
            generatorName: 'Quote Generator',
            aiProvider: 'openai',
            aiModel: 'gpt-4.1-nano',
            modelTier: 'LIGHT',
            tokensUsed: 250,
            errorType: 'ContentValidationError',
            errorMessage: 'Content exceeds 6 lines',
          })
        );
      });

      it('should save with empty fields when provider fails (no content)', async () => {
        // Arrange
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T10:30:00Z'),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'news-gen',
            name: 'News Generator',
            priority: 2,
            modelTier: ModelTier.MEDIUM,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        // Provider throws before content is generated
        const rateLimitError = new RateLimitError('Rate limit exceeded');

        const fallbackContent: GeneratedContent = {
          text: 'Static fallback content',
          outputMode: 'text',
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockRejectedValue(rateLimitError);
        mockFallbackGenerator.generate.mockResolvedValue(fallbackContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act
        await orchestrator.generateAndSend(context);

        // Wait for fire-and-forget promise
        await new Promise(resolve => setImmediate(resolve));

        // Assert - Should save with empty text and aiProvider when no content was generated
        expect(mockContentRepository.saveContent).toHaveBeenCalledWith(
          expect.objectContaining({
            text: '',
            status: 'failed',
            aiProvider: '',
            errorType: 'RateLimitError',
            errorMessage: 'Rate limit exceeded',
          })
        );
      });

      it('should save failed generation when retry exhaustion triggers P3 fallback', async () => {
        // Arrange
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T10:30:00Z'),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'news',
            name: 'Global News',
            priority: 2,
            modelTier: ModelTier.MEDIUM,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const rateLimitError = new RateLimitError('Both providers rate limited');

        const fallbackContent: GeneratedContent = {
          text: 'Static fallback content',
          outputMode: 'text',
          metadata: {
            source: 'static-fallback',
          },
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockRejectedValue(rateLimitError);
        mockFallbackGenerator.generate.mockResolvedValue(fallbackContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act
        await orchestrator.generateAndSend(context);

        // Wait for fire-and-forget promise
        await new Promise(resolve => setImmediate(resolve));

        // Assert - Should save the ORIGINAL failure, not the fallback success
        expect(mockContentRepository.saveContent).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.any(String), // Could be empty or partial
            type: 'major',
            generatedAt: context.timestamp,
            status: 'failed',
            generatorId: 'news',
            generatorName: 'Global News',
            priority: 2,
            errorType: 'RateLimitError',
            errorMessage: 'Both providers rate limited',
          })
        );
      });

      it('should save failed generation with authentication error details', async () => {
        // Arrange
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T10:30:00Z'),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'tech-news',
            name: 'Tech News',
            priority: 2,
            modelTier: ModelTier.MEDIUM,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const authError = new AuthenticationError('Invalid API key');

        const fallbackContent: GeneratedContent = {
          text: 'Static fallback content',
          outputMode: 'text',
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockRejectedValue(authError);
        mockFallbackGenerator.generate.mockResolvedValue(fallbackContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act
        await orchestrator.generateAndSend(context);

        // Wait for fire-and-forget promise
        await new Promise(resolve => setImmediate(resolve));

        // Assert
        expect(mockContentRepository.saveContent).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'failed',
            errorType: 'AuthenticationError',
            errorMessage: 'Invalid API key',
          })
        );
      });
    });

    describe('Fire-and-Forget Pattern', () => {
      it('should not throw error if database save fails on success path', async () => {
        // Arrange
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T10:30:00Z'),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'motivational',
            name: 'Motivational Quote',
            priority: 2,
            modelTier: ModelTier.LIGHT,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const generatedContent: GeneratedContent = {
          text: 'SUCCESS CONTENT',
          outputMode: 'text',
          metadata: {
            provider: 'openai',
            model: 'gpt-4.1-nano',
          },
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Database save fails
        mockContentRepository.saveContent.mockRejectedValue(new Error('Database error'));

        // Act & Assert - Should not throw, and should return success result
        const result = await orchestrator.generateAndSend(context);
        expect(result.success).toBe(true);
      });

      it('should not throw error if database save fails on failure path', async () => {
        // Arrange
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T10:30:00Z'),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'news',
            name: 'Global News',
            priority: 2,
            modelTier: ModelTier.MEDIUM,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const fallbackContent: GeneratedContent = {
          text: 'Static fallback content',
          outputMode: 'text',
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockRejectedValue(new RateLimitError('Rate limited'));
        mockFallbackGenerator.generate.mockResolvedValue(fallbackContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Database save fails
        mockContentRepository.saveContent.mockRejectedValue(new Error('Database error'));

        // Act & Assert - Should not throw, and should return success result
        const result = await orchestrator.generateAndSend(context);
        expect(result.success).toBe(true);
      });
    });

    describe('Repository Optional (Backward Compatibility)', () => {
      it('should work without ContentRepository injected', async () => {
        // Arrange
        const orchestratorWithoutRepo = new ContentOrchestrator({
          selector: mockSelector,
          decorator: mockDecorator,
          vestaboardClient: mockVestaboardClient,
          fallbackGenerator: mockFallbackGenerator,
          preferredProvider: mockPreferredProvider,
          alternateProvider: mockAlternateProvider,
          // No contentRepository
        });

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'test-gen',
            name: 'Test Generator',
            priority: 2,
            modelTier: ModelTier.LIGHT,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const generatedContent: GeneratedContent = {
          text: 'TEST CONTENT',
          outputMode: 'text',
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act & Assert - Should not throw, and should return success result
        const result = await orchestratorWithoutRepo.generateAndSend(context);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Format Options Wiring', () => {
    it('should pass formatOptions from registration to decorator.decorate()', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const formatOptions = {
        textAlign: 'center' as const,
        wordWrap: true,
        maxLines: 4,
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'centered-gen',
          name: 'Centered Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
          formatOptions, // Generator specifies formatting options
        },
        generator: mockGenerator,
      };

      const generatedContent: GeneratedContent = {
        text: 'CENTERED CONTENT',
        outputMode: 'text',
      };

      const decoratedLayout = [[1, 2, 3]];

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: decoratedLayout,
        warnings: [],
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert - formatOptions should be passed to decorate()
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'CENTERED CONTENT',
        context.timestamp,
        undefined, // contentData
        formatOptions // formatOptions from registration
      );
    });

    it('should pass undefined formatOptions when registration has no formatOptions', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'no-format-gen',
          name: 'No Format Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
          // No formatOptions - should use defaults
        },
        generator: mockGenerator,
      };

      const generatedContent: GeneratedContent = {
        text: 'DEFAULT CONTENT',
        outputMode: 'text',
      };

      const decoratedLayout = [[1, 2, 3]];

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: decoratedLayout,
        warnings: [],
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert - undefined formatOptions (backward compatible)
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'DEFAULT CONTENT',
        context.timestamp,
        undefined, // contentData
        undefined // formatOptions (not specified in registration)
      );
    });

    it('should pass formatOptions with right alignment', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const formatOptions = {
        textAlign: 'right' as const,
        wordWrap: false,
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'right-aligned-gen',
          name: 'Right Aligned Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
          formatOptions,
        },
        generator: mockGenerator,
      };

      const generatedContent: GeneratedContent = {
        text: 'RIGHT ALIGNED',
        outputMode: 'text',
      };

      const decoratedLayout = [[1, 2, 3]];

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: decoratedLayout,
        warnings: [],
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'RIGHT ALIGNED',
        context.timestamp,
        undefined,
        formatOptions
      );
    });

    it('should pass formatOptions when using generatorId for direct lookup', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        generatorId: 'specific-gen', // Direct generator lookup
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const formatOptions = {
        textAlign: 'left' as const,
        maxCharsPerLine: 18,
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'specific-gen',
          name: 'Specific Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
          formatOptions,
        },
        generator: mockGenerator,
      };

      const generatedContent: GeneratedContent = {
        text: 'SPECIFIC CONTENT',
        outputMode: 'text',
      };

      const decoratedLayout = [[1, 2, 3]];

      // Create orchestrator with registry for direct lookup
      const mockRegistry = {
        getById: jest.fn().mockReturnValue(registeredGenerator),
      };

      const orchestratorWithRegistry = new ContentOrchestrator({
        selector: mockSelector,
        registry:
          mockRegistry as unknown as import('@/content/registry/content-registry').ContentRegistry,
        decorator: mockDecorator,
        vestaboardClient: mockVestaboardClient,
        fallbackGenerator: mockFallbackGenerator,
        preferredProvider: mockPreferredProvider,
        alternateProvider: mockAlternateProvider,
      });

      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: decoratedLayout,
        warnings: [],
      });

      // Act
      await orchestratorWithRegistry.generateAndSend(context);

      // Assert
      expect(mockRegistry.getById).toHaveBeenCalledWith('specific-gen');
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'SPECIFIC CONTENT',
        context.timestamp,
        undefined,
        formatOptions
      );
    });

    it('should not pass formatOptions to decorator when outputMode is layout', async () => {
      // Arrange - layout mode bypasses decorator entirely
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn(),
        validate: jest.fn().mockReturnValue({ valid: true }),
      };

      const formatOptions = {
        textAlign: 'center' as const,
        wordWrap: true,
      };

      const registeredGenerator: RegisteredGenerator = {
        registration: {
          id: 'layout-gen',
          name: 'Layout Generator',
          priority: 2,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
          formatOptions, // Has formatOptions but should be ignored for layout mode
        },
        generator: mockGenerator,
      };

      const preFormattedCharacterCodes = Array(6)
        .fill(null)
        .map(() => Array(22).fill(0));

      const generatedContent: GeneratedContent = {
        text: '',
        outputMode: 'layout', // Layout mode - decorator should not be called
        layout: {
          rows: ['ROW ONE', 'ROW TWO', 'ROW THREE', 'ROW FOUR', 'ROW FIVE', 'ROW SIX'],
          characterCodes: preFormattedCharacterCodes,
        },
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);

      // Act
      await orchestrator.generateAndSend(context);

      // Assert - decorator should NOT be called for layout mode
      expect(mockDecorator.decorate).not.toHaveBeenCalled();
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledWith(preFormattedCharacterCodes);
    });
  });

  describe('Circuit Breaker Integration', () => {
    let mockCircuitBreaker: jest.Mocked<CircuitBreakerService>;

    beforeEach(() => {
      mockCircuitBreaker = {
        isCircuitOpen: jest.fn(),
        isProviderAvailable: jest.fn(),
        initialize: jest.fn(),
        setCircuitState: jest.fn(),
        getCircuitStatus: jest.fn(),
        getAllCircuits: jest.fn(),
        getCircuitsByType: jest.fn(),
        recordProviderFailure: jest.fn(),
        recordProviderSuccess: jest.fn(),
        getProviderStatus: jest.fn(),
        resetProviderCircuit: jest.fn(),
      } as unknown as jest.Mocked<CircuitBreakerService>;
    });

    describe('Master Circuit Check', () => {
      it('should block generation when MASTER circuit is OFF', async () => {
        // Arrange
        const orchestratorWithCircuitBreaker = new ContentOrchestrator({
          selector: mockSelector,
          decorator: mockDecorator,
          vestaboardClient: mockVestaboardClient,
          fallbackGenerator: mockFallbackGenerator,
          preferredProvider: mockPreferredProvider,
          alternateProvider: mockAlternateProvider,
          circuitBreaker: mockCircuitBreaker,
        });

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
        };

        // MASTER circuit is OFF (isCircuitOpen returns true when OFF)
        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(true);

        // Act
        const result = await orchestratorWithCircuitBreaker.generateAndSend(context);

        // Assert
        expect(result.success).toBe(false);
        expect(result.blocked).toBe(true);
        expect(result.blockReason).toBe('master_circuit_off');
        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('MASTER');
        expect(mockSelector.select).not.toHaveBeenCalled();
        expect(mockVestaboardClient.sendLayout).not.toHaveBeenCalled();
      });

      it('should allow generation when MASTER circuit is ON', async () => {
        // Arrange
        const orchestratorWithCircuitBreaker = new ContentOrchestrator({
          selector: mockSelector,
          decorator: mockDecorator,
          vestaboardClient: mockVestaboardClient,
          fallbackGenerator: mockFallbackGenerator,
          preferredProvider: mockPreferredProvider,
          alternateProvider: mockAlternateProvider,
          circuitBreaker: mockCircuitBreaker,
        });

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'test-gen',
            name: 'Test Generator',
            priority: 2,
            modelTier: ModelTier.LIGHT,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const generatedContent: GeneratedContent = {
          text: 'TEST CONTENT',
          outputMode: 'text',
        };

        // MASTER circuit is ON (isCircuitOpen returns false when ON)
        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);
        mockCircuitBreaker.isProviderAvailable.mockResolvedValue(true);
        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act
        const result = await orchestratorWithCircuitBreaker.generateAndSend(context);

        // Assert
        expect(result.success).toBe(true);
        expect(result.blocked).toBeUndefined();
        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('MASTER');
        expect(mockSelector.select).toHaveBeenCalled();
        expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
      });

      it('should include circuit state in result when blocked', async () => {
        // Arrange
        const orchestratorWithCircuitBreaker = new ContentOrchestrator({
          selector: mockSelector,
          decorator: mockDecorator,
          vestaboardClient: mockVestaboardClient,
          fallbackGenerator: mockFallbackGenerator,
          preferredProvider: mockPreferredProvider,
          alternateProvider: mockAlternateProvider,
          circuitBreaker: mockCircuitBreaker,
        });

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
        };

        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(true);

        // Act
        const result = await orchestratorWithCircuitBreaker.generateAndSend(context);

        // Assert
        expect(result.circuitState).toBeDefined();
        expect(result.circuitState?.master).toBe(false); // master is OFF
      });
    });

    describe('Provider Circuit Check', () => {
      it('should skip to fallback when provider circuit is OPEN', async () => {
        // Arrange
        const orchestratorWithCircuitBreaker = new ContentOrchestrator({
          selector: mockSelector,
          decorator: mockDecorator,
          vestaboardClient: mockVestaboardClient,
          fallbackGenerator: mockFallbackGenerator,
          preferredProvider: mockPreferredProvider,
          alternateProvider: mockAlternateProvider,
          circuitBreaker: mockCircuitBreaker,
        });

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'test-gen',
            name: 'Test Generator',
            priority: 2,
            modelTier: ModelTier.LIGHT,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const fallbackContent: GeneratedContent = {
          text: 'Fallback content',
          outputMode: 'text',
        };

        // MASTER is ON, but provider circuit is OPEN (unavailable)
        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);
        mockCircuitBreaker.isProviderAvailable.mockResolvedValue(false);
        mockSelector.select.mockReturnValue(registeredGenerator);
        mockFallbackGenerator.generate.mockResolvedValue(fallbackContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Spy on console.log
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        // Act
        const result = await orchestratorWithCircuitBreaker.generateAndSend(context);

        // Assert
        expect(result.success).toBe(true);
        expect(mockCircuitBreaker.isProviderAvailable).toHaveBeenCalled();
        expect(mockFallbackGenerator.generate).toHaveBeenCalledWith(context);
        expect(generateWithRetry).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Provider circuit'));

        logSpy.mockRestore();
      });

      it('should proceed with generation when provider circuit is available', async () => {
        // Arrange
        const orchestratorWithCircuitBreaker = new ContentOrchestrator({
          selector: mockSelector,
          decorator: mockDecorator,
          vestaboardClient: mockVestaboardClient,
          fallbackGenerator: mockFallbackGenerator,
          preferredProvider: mockPreferredProvider,
          alternateProvider: mockAlternateProvider,
          circuitBreaker: mockCircuitBreaker,
        });

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'test-gen',
            name: 'Test Generator',
            priority: 2,
            modelTier: ModelTier.LIGHT,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const generatedContent: GeneratedContent = {
          text: 'Generated content',
          outputMode: 'text',
        };

        // Both circuits available
        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);
        mockCircuitBreaker.isProviderAvailable.mockResolvedValue(true);
        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act
        const result = await orchestratorWithCircuitBreaker.generateAndSend(context);

        // Assert
        expect(result.success).toBe(true);
        expect(generateWithRetry).toHaveBeenCalled();
        expect(mockFallbackGenerator.generate).not.toHaveBeenCalled();
      });
    });

    describe('Backward Compatibility', () => {
      it('should work without circuitBreaker (backward compatible)', async () => {
        // Arrange - orchestrator created without circuitBreaker
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'test-gen',
            name: 'Test Generator',
            priority: 2,
            modelTier: ModelTier.LIGHT,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const generatedContent: GeneratedContent = {
          text: 'TEST CONTENT',
          outputMode: 'text',
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act - using original orchestrator without circuitBreaker
        const result = await orchestrator.generateAndSend(context);

        // Assert - should work normally without circuit breaker checks
        expect(result.success).toBe(true);
        expect(mockSelector.select).toHaveBeenCalled();
        expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
      });

      it('should return OrchestratorResult with success: true on successful generation', async () => {
        // Arrange
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn(),
          validate: jest.fn().mockReturnValue({ valid: true }),
        };

        const registeredGenerator: RegisteredGenerator = {
          registration: {
            id: 'test-gen',
            name: 'Test Generator',
            priority: 2,
            modelTier: ModelTier.LIGHT,
            applyFrame: true,
          },
          generator: mockGenerator,
        };

        const generatedContent: GeneratedContent = {
          text: 'SUCCESS',
          outputMode: 'text',
        };

        mockSelector.select.mockReturnValue(registeredGenerator);
        (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
        mockDecorator.decorate.mockResolvedValue({
          layout: [[1, 2, 3]],
          warnings: [],
        });

        // Act
        const result = await orchestrator.generateAndSend(context);

        // Assert
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.content).toEqual(generatedContent);
      });
    });
  });
});
