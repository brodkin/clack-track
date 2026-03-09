/**
 * Tests for MinorUpdateGenerator
 *
 * Test scenarios:
 * 1. Constructor accepts ContentOrchestrator and FrameDecorator
 * 2. generate() with outputMode 'text' retrieves cache and reapplies frame
 * 3. generate() with outputMode 'layout' returns cached layout directly
 * 4. generate() with null cache throws descriptive error
 * 5. generate() passes correct timestamp to FrameDecorator
 * 6. generate() preserves cached content metadata
 */

import { MinorUpdateGenerator } from '@/content/generators/minor-update';
import type { ContentOrchestrator } from '@/content/orchestrator';
import type { FrameDecorator } from '@/content/frame/frame-decorator';
import type { GeneratedContent, GenerationContext } from '@/types/content-generator';
import type { FrameResult } from '@/content/frame/frame-generator';

describe('MinorUpdateGenerator', () => {
  let mockOrchestrator: jest.Mocked<ContentOrchestrator>;
  let mockDecorator: jest.Mocked<FrameDecorator>;
  let generator: MinorUpdateGenerator;

  beforeEach(() => {
    // Mock ContentOrchestrator
    mockOrchestrator = {
      getCachedContent: jest.fn(),
      generateAndSend: jest.fn(),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<ContentOrchestrator>;

    // Mock FrameDecorator
    mockDecorator = {
      decorate: jest.fn(),
    } as unknown as jest.Mocked<FrameDecorator>;

    // Create generator instance
    generator = new MinorUpdateGenerator(mockOrchestrator, mockDecorator);
  });

  describe('constructor', () => {
    it('should accept ContentOrchestrator and FrameDecorator dependencies', () => {
      expect(generator).toBeInstanceOf(MinorUpdateGenerator);
      expect(generator).toBeDefined();
    });
  });

  describe('generate() with outputMode "text"', () => {
    it('should retrieve cached content from orchestrator', async () => {
      // Arrange
      const cachedContent: GeneratedContent = {
        text: 'STAY FOCUSED AND KEEP MOVING',
        outputMode: 'text',
        metadata: { source: 'ai-generator' },
      };

      const frameResult: FrameResult = {
        layout: [[1, 2, 3]], // Mock layout
        warnings: [],
      };

      mockOrchestrator.getCachedContent.mockReturnValue(cachedContent);
      mockDecorator.decorate.mockResolvedValue(frameResult);

      const context: GenerationContext = {
        updateType: 'minor',
        timestamp: new Date('2025-01-15T10:30:00Z'),
      };

      // Act
      await generator.generate(context);

      // Assert
      expect(mockOrchestrator.getCachedContent).toHaveBeenCalledTimes(1);
    });

    it('should call FrameDecorator.decorate with cached text and context timestamp', async () => {
      // Arrange
      const cachedContent: GeneratedContent = {
        text: 'MOTIVATIONAL CONTENT HERE',
        outputMode: 'text',
      };

      const frameResult: FrameResult = {
        layout: [[1, 2, 3]], // Mock layout
        warnings: [],
      };

      mockOrchestrator.getCachedContent.mockReturnValue(cachedContent);
      mockDecorator.decorate.mockResolvedValue(frameResult);

      const timestamp = new Date('2025-01-15T10:30:00Z');
      const context: GenerationContext = {
        updateType: 'minor',
        timestamp,
      };

      // Act
      await generator.generate(context);

      // Assert
      expect(mockDecorator.decorate).toHaveBeenCalledTimes(1);
      expect(mockDecorator.decorate).toHaveBeenCalledWith('MOTIVATIONAL CONTENT HERE', timestamp);
    });

    it('should return GeneratedContent with decorated layout and new timestamp', async () => {
      // Arrange
      const cachedContent: GeneratedContent = {
        text: 'CACHED MESSAGE',
        outputMode: 'text',
        metadata: { original: true },
      };

      const decoratedLayout = [
        [1, 2, 3, 4, 5, 6],
        [7, 8, 9, 10, 11, 12],
      ];

      const frameResult: FrameResult = {
        layout: decoratedLayout,
        warnings: ['Warning: test'],
      };

      mockOrchestrator.getCachedContent.mockReturnValue(cachedContent);
      mockDecorator.decorate.mockResolvedValue(frameResult);

      const context: GenerationContext = {
        updateType: 'minor',
        timestamp: new Date('2025-01-15T10:30:00Z'),
      };

      // Act
      const result = await generator.generate(context);

      // Assert - verify important properties without asserting implementation details
      expect(result.text).toBe('CACHED MESSAGE');
      expect(result.outputMode).toBe('layout');
      expect(result.layout?.characterCodes).toEqual(decoratedLayout);

      // Verify metadata contains expected properties (not checking for empty rows array)
      expect(result.metadata).toMatchObject({
        original: true,
        minorUpdate: true,
        updatedAt: context.timestamp.toISOString(),
        warnings: ['Warning: test'],
      });

      // Verify all original metadata properties are preserved
      expect(result.metadata?.original).toBe(true);
      expect(result.metadata?.minorUpdate).toBe(true);
    });

    it('should preserve original metadata and add minor update metadata', async () => {
      // Arrange
      const cachedContent: GeneratedContent = {
        text: 'CONTENT',
        outputMode: 'text',
        metadata: {
          aiModel: 'gpt-4o-mini',
          temperature: 0.7,
          source: 'motivational',
        },
      };

      const frameResult: FrameResult = {
        layout: [[1]],
        warnings: [],
      };

      mockOrchestrator.getCachedContent.mockReturnValue(cachedContent);
      mockDecorator.decorate.mockResolvedValue(frameResult);

      const timestamp = new Date('2025-01-15T10:30:00Z');
      const context: GenerationContext = {
        updateType: 'minor',
        timestamp,
      };

      // Act
      const result = await generator.generate(context);

      // Assert - verify metadata contains expected properties without checking structure
      expect(result.metadata).toMatchObject({
        aiModel: 'gpt-4o-mini',
        temperature: 0.7,
        source: 'motivational',
        minorUpdate: true,
        updatedAt: timestamp.toISOString(),
      });
    });
  });

  describe('generate() with outputMode "layout"', () => {
    it('should return cached layout directly without calling FrameDecorator', async () => {
      // Arrange
      const cachedLayout = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
      ];

      const cachedContent: GeneratedContent = {
        text: 'PRE-FORMATTED CONTENT',
        outputMode: 'layout',
        layout: {
          characterCodes: cachedLayout,
        },
        metadata: { preformatted: true },
      };

      mockOrchestrator.getCachedContent.mockReturnValue(cachedContent);

      const context: GenerationContext = {
        updateType: 'minor',
        timestamp: new Date('2025-01-15T10:30:00Z'),
      };

      // Act
      const result = await generator.generate(context);

      // Assert - verify behavior without asserting exact structure
      expect(mockDecorator.decorate).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        text: 'PRE-FORMATTED CONTENT',
        outputMode: 'layout',
        layout: expect.objectContaining({
          characterCodes: cachedLayout,
        }),
        metadata: expect.objectContaining({
          preformatted: true,
        }),
      });
    });

    it('should preserve all cached content properties for layout mode', async () => {
      // Arrange
      const cachedContent: GeneratedContent = {
        text: 'LAYOUT CONTENT',
        outputMode: 'layout',
        layout: {
          characterCodes: [
            [1, 2],
            [3, 4],
          ],
        },
        metadata: {
          source: 'static-fallback',
          priority: 3,
        },
      };

      mockOrchestrator.getCachedContent.mockReturnValue(cachedContent);

      const context: GenerationContext = {
        updateType: 'minor',
        timestamp: new Date('2025-01-15T10:30:00Z'),
      };

      // Act
      const result = await generator.generate(context);

      // Assert - verify important properties without asserting exact structure
      expect(result.text).toBe('LAYOUT CONTENT');
      expect(result.outputMode).toBe('layout');
      expect(result.layout?.characterCodes).toEqual([
        [1, 2],
        [3, 4],
      ]);
      expect(result.metadata).toMatchObject({
        source: 'static-fallback',
        priority: 3,
      });
    });
  });

  describe('generate() with null cache', () => {
    it('should throw descriptive error when cache is null', async () => {
      // Arrange
      mockOrchestrator.getCachedContent.mockReturnValue(null);

      const context: GenerationContext = {
        updateType: 'minor',
        timestamp: new Date('2025-01-15T10:30:00Z'),
      };

      // Act & Assert
      await expect(generator.generate(context)).rejects.toThrow(
        'No cached content available for minor update. A major update must be performed first.'
      );
    });

    it('should not call FrameDecorator when cache is null', async () => {
      // Arrange
      mockOrchestrator.getCachedContent.mockReturnValue(null);

      const context: GenerationContext = {
        updateType: 'minor',
        timestamp: new Date('2025-01-15T10:30:00Z'),
      };

      // Act & Assert
      await expect(generator.generate(context)).rejects.toThrow();
      expect(mockDecorator.decorate).not.toHaveBeenCalled();
    });
  });

  describe('validate()', () => {
    it('should return valid result when dependencies are provided', async () => {
      // Act
      const result = await generator.validate();

      // Assert
      expect(result).toEqual({ valid: true });
    });
  });

  describe('edge cases', () => {
    it('should handle cached content with no metadata', async () => {
      // Arrange
      const cachedContent: GeneratedContent = {
        text: 'NO METADATA',
        outputMode: 'text',
        // No metadata property
      };

      const frameResult: FrameResult = {
        layout: [[1]],
        warnings: [],
      };

      mockOrchestrator.getCachedContent.mockReturnValue(cachedContent);
      mockDecorator.decorate.mockResolvedValue(frameResult);

      const timestamp = new Date('2025-01-15T10:30:00Z');
      const context: GenerationContext = {
        updateType: 'minor',
        timestamp,
      };

      // Act
      const result = await generator.generate(context);

      // Assert - verify metadata properties without asserting exact structure
      expect(result.metadata).toMatchObject({
        minorUpdate: true,
        updatedAt: timestamp.toISOString(),
      });
    });

    it('should handle FrameDecorator warnings', async () => {
      // Arrange
      const cachedContent: GeneratedContent = {
        text: 'CONTENT WITH WARNINGS',
        outputMode: 'text',
      };

      const frameResult: FrameResult = {
        layout: [[1]],
        warnings: ['Warning: Weather unavailable', 'Warning: Time format issue'],
      };

      mockOrchestrator.getCachedContent.mockReturnValue(cachedContent);
      mockDecorator.decorate.mockResolvedValue(frameResult);

      const context: GenerationContext = {
        updateType: 'minor',
        timestamp: new Date('2025-01-15T10:30:00Z'),
      };

      // Act
      const result = await generator.generate(context);

      // Assert - warnings should be preserved in metadata
      expect(result.metadata?.warnings).toEqual([
        'Warning: Weather unavailable',
        'Warning: Time format issue',
      ]);
    });
  });

  describe('shouldSkip()', () => {
    it('should return true when cached content has outputMode "layout"', () => {
      // Arrange - cached content is full-frame layout
      const cachedContent: GeneratedContent = {
        text: 'FULL FRAME CONTENT',
        outputMode: 'layout',
        layout: {
          characterCodes: [[1, 2, 3]],
        },
      };

      mockOrchestrator.getCachedContent.mockReturnValue(cachedContent);

      // Act
      const result = generator.shouldSkip();

      // Assert - should skip minor update for full-frame content
      expect(result).toBe(true);
    });

    it('should return false when cached content has outputMode "text"', () => {
      // Arrange - cached content is text that needs frame refresh
      const cachedContent: GeneratedContent = {
        text: 'TEXT CONTENT',
        outputMode: 'text',
      };

      mockOrchestrator.getCachedContent.mockReturnValue(cachedContent);

      // Act
      const result = generator.shouldSkip();

      // Assert - should NOT skip, text content needs frame refresh
      expect(result).toBe(false);
    });

    it('should return false when no cached content exists', () => {
      // Arrange - no cached content
      mockOrchestrator.getCachedContent.mockReturnValue(null);

      // Act
      const result = generator.shouldSkip();

      // Assert - should NOT skip (will error during generate, not during skip check)
      expect(result).toBe(false);
    });
  });
});
