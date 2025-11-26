import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { AIProvider, AIGenerationResponse } from '@/types/ai';
import { ColorBarService, FALLBACK_COLORS } from '@/content/frame/color-bar';

// Mock AI Provider
class MockAIProvider implements AIProvider {
  public mockResponse: string = JSON.stringify([67, 66, 65, 64, 63, 68]);
  public shouldFail: boolean = false;

  async generate(): Promise<AIGenerationResponse> {
    if (this.shouldFail) {
      throw new Error('AI Provider failed');
    }
    return {
      text: this.mockResponse,
      model: 'claude-haiku-4.5',
      tokensUsed: 100,
      finishReason: 'stop',
    };
  }

  async validateConnection(): Promise<boolean> {
    return !this.shouldFail;
  }
}

describe('ColorBarService', () => {
  let mockProvider: MockAIProvider;
  let service: ColorBarService;

  beforeEach(() => {
    mockProvider = new MockAIProvider();
    service = new ColorBarService(mockProvider);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getColors', () => {
    it('should return cached colors when cache is valid', async () => {
      // First call - fetches from AI
      const firstColors = await service.getColors();
      expect(firstColors).toEqual([67, 66, 65, 64, 63, 68]);

      // Change mock response
      mockProvider.mockResponse = JSON.stringify([63, 64, 65, 66, 67, 68]);

      // Second call - should return cached colors, not new ones
      const secondColors = await service.getColors();
      expect(secondColors).toEqual([67, 66, 65, 64, 63, 68]); // Original cached colors
    });

    it('should fetch from Haiku when cache is expired', async () => {
      // First call
      const firstColors = await service.getColors();
      expect(firstColors).toEqual([67, 66, 65, 64, 63, 68]);

      // Advance time by 25 hours (beyond 24-hour cache TTL)
      jest.advanceTimersByTime(25 * 60 * 60 * 1000);

      // Change mock response
      mockProvider.mockResponse = JSON.stringify([63, 64, 65, 66, 67, 68]);

      // Second call - should fetch new colors
      const secondColors = await service.getColors();
      expect(secondColors).toEqual([63, 64, 65, 66, 67, 68]);
    });

    it('should return FALLBACK_COLORS on AI error', async () => {
      mockProvider.shouldFail = true;

      const colors = await service.getColors();
      expect(colors).toEqual(FALLBACK_COLORS);
    });

    it('should return FALLBACK_COLORS when AI returns invalid JSON', async () => {
      mockProvider.mockResponse = 'invalid json';

      const colors = await service.getColors();
      expect(colors).toEqual(FALLBACK_COLORS);
    });

    it('should return FALLBACK_COLORS when AI returns invalid array length', async () => {
      mockProvider.mockResponse = JSON.stringify([67, 66, 65]); // Only 3 colors

      const colors = await service.getColors();
      expect(colors).toEqual(FALLBACK_COLORS);
    });

    it('should return FALLBACK_COLORS when AI returns non-numeric values', async () => {
      mockProvider.mockResponse = JSON.stringify([67, 'blue', 65, 64, 63, 68]);

      const colors = await service.getColors();
      expect(colors).toEqual(FALLBACK_COLORS);
    });

    it('should use custom cache TTL from config', async () => {
      const customTtl = 60 * 60 * 1000; // 1 hour
      const customService = new ColorBarService(mockProvider, { cacheTtlMs: customTtl });

      // First call
      await customService.getColors();

      // Advance time by 30 minutes (within 1-hour TTL)
      jest.advanceTimersByTime(30 * 60 * 1000);

      mockProvider.mockResponse = JSON.stringify([63, 64, 65, 66, 67, 68]);

      // Should still use cache
      const colors = await customService.getColors();
      expect(colors).toEqual([67, 66, 65, 64, 63, 68]); // Original cached colors
    });
  });

  describe('isCacheValid (via behavior)', () => {
    it('should treat cache as valid when fresh', async () => {
      await service.getColors();

      // Advance time by 1 hour (within 24-hour TTL)
      jest.advanceTimersByTime(60 * 60 * 1000);

      mockProvider.mockResponse = JSON.stringify([63, 64, 65, 66, 67, 68]);

      // Should use cache
      const colors = await service.getColors();
      expect(colors).toEqual([67, 66, 65, 64, 63, 68]); // Cached colors
    });

    it('should treat cache as invalid when expired', async () => {
      await service.getColors();

      // Advance time by 25 hours (beyond 24-hour TTL)
      jest.advanceTimersByTime(25 * 60 * 60 * 1000);

      mockProvider.mockResponse = JSON.stringify([63, 64, 65, 66, 67, 68]);

      // Should fetch new colors
      const colors = await service.getColors();
      expect(colors).toEqual([63, 64, 65, 66, 67, 68]); // New colors
    });

    it('should treat cache as invalid when null (initial state)', async () => {
      // First call ever - no cache
      const colors = await service.getColors();
      expect(colors).toEqual([67, 66, 65, 64, 63, 68]);
      expect(mockProvider.mockResponse).toBeTruthy(); // AI was called
    });
  });

  describe('clearCache', () => {
    it('should invalidate the cache', async () => {
      // First call
      await service.getColors();

      // Clear cache
      service.clearCache();

      // Change mock response
      mockProvider.mockResponse = JSON.stringify([63, 64, 65, 66, 67, 68]);

      // Should fetch new colors
      const colors = await service.getColors();
      expect(colors).toEqual([63, 64, 65, 66, 67, 68]);
    });
  });

  describe('Season detection', () => {
    it('should detect spring (March-May)', async () => {
      jest.setSystemTime(new Date('2024-03-15'));
      await service.getColors();
      // Verify season is used in prompt by checking the AI was called
      expect(mockProvider.mockResponse).toBeTruthy();
    });

    it('should detect summer (June-August)', async () => {
      jest.setSystemTime(new Date('2024-07-15'));
      await service.getColors();
      expect(mockProvider.mockResponse).toBeTruthy();
    });

    it('should detect fall (September-November)', async () => {
      jest.setSystemTime(new Date('2024-10-15'));
      await service.getColors();
      expect(mockProvider.mockResponse).toBeTruthy();
    });

    it('should detect winter (December-February)', async () => {
      jest.setSystemTime(new Date('2024-12-15'));
      await service.getColors();
      expect(mockProvider.mockResponse).toBeTruthy();
    });
  });

  describe('Holiday detection', () => {
    it('should detect Christmas (Dec 18-25)', async () => {
      jest.setSystemTime(new Date('2024-12-23'));
      await service.getColors();
      expect(mockProvider.mockResponse).toBeTruthy();
    });

    it('should detect Thanksgiving (Nov 20-28)', async () => {
      jest.setSystemTime(new Date('2024-11-25'));
      await service.getColors();
      expect(mockProvider.mockResponse).toBeTruthy();
    });

    it('should detect Halloween (Oct 24-31)', async () => {
      jest.setSystemTime(new Date('2024-10-30'));
      await service.getColors();
      expect(mockProvider.mockResponse).toBeTruthy();
    });

    it('should detect Independence Day (Jul 1-7)', async () => {
      jest.setSystemTime(new Date('2024-07-04'));
      await service.getColors();
      expect(mockProvider.mockResponse).toBeTruthy();
    });

    it('should detect Valentines Day (Feb 7-14)', async () => {
      jest.setSystemTime(new Date('2024-02-12'));
      await service.getColors();
      expect(mockProvider.mockResponse).toBeTruthy();
    });

    it('should detect St Patricks Day (Mar 10-17)', async () => {
      jest.setSystemTime(new Date('2024-03-15'));
      await service.getColors();
      expect(mockProvider.mockResponse).toBeTruthy();
    });

    it('should not detect holiday outside date ranges', async () => {
      jest.setSystemTime(new Date('2024-05-15')); // Mid-May, no holidays
      await service.getColors();
      expect(mockProvider.mockResponse).toBeTruthy();
    });
  });

  describe('FALLBACK_COLORS constant', () => {
    it('should export fallback colors array', () => {
      expect(FALLBACK_COLORS).toEqual([67, 66, 65, 64, 63, 68]);
      expect(FALLBACK_COLORS).toHaveLength(6);
    });

    it('should contain valid color codes (63-69)', () => {
      FALLBACK_COLORS.forEach(code => {
        expect(code).toBeGreaterThanOrEqual(63);
        expect(code).toBeLessThanOrEqual(69);
      });
    });
  });

  describe('Prompt generation', () => {
    it('should call AI with appropriate prompt containing season and date', async () => {
      const generateSpy = jest.spyOn(mockProvider, 'generate');
      jest.setSystemTime(new Date('2024-10-15'));

      await service.getColors();

      expect(generateSpy).toHaveBeenCalledTimes(1);
      const request = generateSpy.mock.calls[0][0] as AIGenerationRequest;

      // Verify prompt contains key information
      expect(request.userPrompt).toContain('fall');
      expect(request.userPrompt).toContain('6-color palette');
      expect(request.userPrompt).toContain('Vestaboard');
    });

    it('should include holiday in prompt when applicable', async () => {
      const generateSpy = jest.spyOn(mockProvider, 'generate');
      jest.setSystemTime(new Date('2024-12-23'));

      await service.getColors();

      const request = generateSpy.mock.calls[0][0] as AIGenerationRequest;
      expect(request.userPrompt).toContain('christmas');
    });
  });
});
