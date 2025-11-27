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
import { RateLimitError, AuthenticationError } from '@/types/errors';
import type { VestaboardClient } from '@/api/vestaboard/types';
import type { AIProvider } from '@/types/ai';
import {
  ModelTier,
  type ContentGenerator,
  type GenerationContext,
  type GeneratedContent,
} from '@/types/content-generator';
import type { RegisteredGenerator } from '@/content/registry/content-registry';

// Mock dependencies
jest.mock('@/content/orchestrator-retry', () => ({
  generateWithRetry: jest.fn(),
}));

const { generateWithRetry } = jest.requireMock('@/content/orchestrator-retry');

describe('ContentOrchestrator', () => {
  let mockSelector: jest.Mocked<ContentSelector>;
  let mockDecorator: jest.Mocked<FrameDecorator>;
  let mockVestaboardClient: jest.Mocked<VestaboardClient>;
  let mockFallbackGenerator: jest.Mocked<StaticFallbackGenerator>;
  let mockPreferredProvider: jest.Mocked<AIProvider>;
  let mockAlternateProvider: jest.Mocked<AIProvider>;
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

    // Reset mocks
    jest.clearAllMocks();

    // Create orchestrator instance
    orchestrator = new ContentOrchestrator({
      selector: mockSelector,
      decorator: mockDecorator,
      vestaboardClient: mockVestaboardClient,
      fallbackGenerator: mockFallbackGenerator,
      preferredProvider: mockPreferredProvider,
      alternateProvider: mockAlternateProvider,
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
        text: 'Test content',
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
      expect(generateWithRetry).toHaveBeenCalledWith(
        mockGenerator,
        context,
        mockPreferredProvider,
        mockAlternateProvider
      );
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'Test content',
        context.timestamp,
        undefined
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

      const preFormattedCharacterCodes = [
        [1, 2, 3],
        [4, 5, 6],
      ];

      const generatedContent: GeneratedContent = {
        text: 'Test content',
        outputMode: 'layout',
        layout: {
          rows: ['ABC', 'DEF'],
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
        text: 'Alternate provider content',
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
      expect(generateWithRetry).toHaveBeenCalledWith(
        mockGenerator,
        context,
        mockPreferredProvider,
        mockAlternateProvider
      );
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
        undefined
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
        text: 'Test content',
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
        text: 'Cached content',
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
        text: 'First content',
        outputMode: 'text',
      };

      const content2: GeneratedContent = {
        text: 'Second content',
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
        text: 'Cached content',
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
});
