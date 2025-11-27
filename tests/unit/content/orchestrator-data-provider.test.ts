/**
 * Unit Tests for ContentOrchestrator - ContentDataProvider Integration
 *
 * Tests integration of ContentDataProvider for pre-fetching weather and color data.
 * Verifies that data is fetched before generation and passed through the pipeline.
 */

import { ContentOrchestrator } from '@/content/orchestrator';
import { ContentSelector } from '@/content/registry/content-selector';
import { FrameDecorator } from '@/content/frame/frame-decorator';
import { StaticFallbackGenerator } from '@/content/generators/static-fallback-generator';
import { ContentDataProvider } from '@/services/content-data-provider';
import type { VestaboardClient } from '@/api/vestaboard/types';
import type { AIProvider } from '@/types/ai';
import type { ContentData } from '@/types/content-data';
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

describe('ContentOrchestrator - ContentDataProvider Integration', () => {
  let mockSelector: jest.Mocked<ContentSelector>;
  let mockDecorator: jest.Mocked<FrameDecorator>;
  let mockVestaboardClient: jest.Mocked<VestaboardClient>;
  let mockFallbackGenerator: jest.Mocked<StaticFallbackGenerator>;
  let mockPreferredProvider: jest.Mocked<AIProvider>;
  let mockAlternateProvider: jest.Mocked<AIProvider>;
  let mockDataProvider: jest.Mocked<ContentDataProvider>;
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

    mockDataProvider = {
      fetchData: jest.fn(),
    } as unknown as jest.Mocked<ContentDataProvider>;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('ContentDataProvider Integration', () => {
    it('should call dataProvider.fetchData() before generation on major updates', async () => {
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

      const mockContentData: ContentData = {
        weather: {
          temperature: 72,
          temperatureUnit: '°F',
          condition: 'Sunny',
          humidity: 45,
        },
        colorBar: [63, 64, 65, 66, 67, 68],
        fetchedAt: new Date(),
        warnings: [],
      };

      const generatedContent: GeneratedContent = {
        text: 'Test content',
        outputMode: 'text',
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      mockDataProvider.fetchData.mockResolvedValue(mockContentData);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      orchestrator = new ContentOrchestrator({
        selector: mockSelector,
        decorator: mockDecorator,
        vestaboardClient: mockVestaboardClient,
        fallbackGenerator: mockFallbackGenerator,
        preferredProvider: mockPreferredProvider,
        alternateProvider: mockAlternateProvider,
        dataProvider: mockDataProvider,
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert
      expect(mockDataProvider.fetchData).toHaveBeenCalledTimes(1);
      expect(mockSelector.select).toHaveBeenCalledWith(
        expect.objectContaining({
          updateType: 'major',
          timestamp: context.timestamp,
          data: mockContentData,
        })
      );
    });

    it('should skip dataProvider.fetchData() on minor updates', async () => {
      // Arrange
      const context: GenerationContext = {
        updateType: 'minor',
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

      orchestrator = new ContentOrchestrator({
        selector: mockSelector,
        decorator: mockDecorator,
        vestaboardClient: mockVestaboardClient,
        fallbackGenerator: mockFallbackGenerator,
        preferredProvider: mockPreferredProvider,
        alternateProvider: mockAlternateProvider,
        dataProvider: mockDataProvider,
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert
      expect(mockDataProvider.fetchData).not.toHaveBeenCalled();
    });

    it('should work without dataProvider for backward compatibility', async () => {
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

      // Create orchestrator WITHOUT dataProvider
      orchestrator = new ContentOrchestrator({
        selector: mockSelector,
        decorator: mockDecorator,
        vestaboardClient: mockVestaboardClient,
        fallbackGenerator: mockFallbackGenerator,
        preferredProvider: mockPreferredProvider,
        alternateProvider: mockAlternateProvider,
        // NO dataProvider - backward compatibility
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert - should complete without errors
      expect(mockSelector.select).toHaveBeenCalledWith(context);
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });

    it('should pass pre-fetched weather data to FrameDecorator', async () => {
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

      const mockContentData: ContentData = {
        weather: {
          temperature: 72,
          temperatureUnit: '°F',
          condition: 'Sunny',
          humidity: 45,
        },
        colorBar: [63, 64, 65, 66, 67, 68],
        fetchedAt: new Date(),
        warnings: [],
      };

      const generatedContent: GeneratedContent = {
        text: 'Test content',
        outputMode: 'text',
      };

      mockSelector.select.mockReturnValue(registeredGenerator);
      mockDataProvider.fetchData.mockResolvedValue(mockContentData);
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      orchestrator = new ContentOrchestrator({
        selector: mockSelector,
        decorator: mockDecorator,
        vestaboardClient: mockVestaboardClient,
        fallbackGenerator: mockFallbackGenerator,
        preferredProvider: mockPreferredProvider,
        alternateProvider: mockAlternateProvider,
        dataProvider: mockDataProvider,
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert
      expect(mockDecorator.decorate).toHaveBeenCalledWith(
        'Test content',
        context.timestamp,
        mockContentData
      );
    });

    it('should continue with null data if dataProvider.fetchData() fails', async () => {
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
      mockDataProvider.fetchData.mockRejectedValue(new Error('Data fetch failed'));
      (generateWithRetry as jest.Mock).mockResolvedValue(generatedContent);
      mockDecorator.decorate.mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      orchestrator = new ContentOrchestrator({
        selector: mockSelector,
        decorator: mockDecorator,
        vestaboardClient: mockVestaboardClient,
        fallbackGenerator: mockFallbackGenerator,
        preferredProvider: mockPreferredProvider,
        alternateProvider: mockAlternateProvider,
        dataProvider: mockDataProvider,
      });

      // Act
      await orchestrator.generateAndSend(context);

      // Assert - should continue with null data
      expect(mockSelector.select).toHaveBeenCalledWith(
        expect.objectContaining({
          updateType: 'major',
          data: undefined,
        })
      );
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });
  });
});
