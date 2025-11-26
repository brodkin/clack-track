/**
 * Tests for CLI frame command
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { frameCommand } from '../../../../src/cli/commands/frame.js';
import { HomeAssistantClient } from '../../../../src/api/data-sources/home-assistant.js';
import { createAIProvider, AIProviderType } from '../../../../src/api/ai/index.js';

// Mock dependencies
jest.mock('../../../../src/content/frame/index.js', () => ({
  generateFrame: jest.fn().mockResolvedValue({
    layout: [
      [8, 5, 12, 12, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // HELLO
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [63, 64, 65, 66, 67, 68, 69, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Color blocks
    ],
    warnings: [],
  }),
}));

jest.mock('../../../../src/api/data-sources/home-assistant.js', () => ({
  HomeAssistantClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../../src/api/ai/index.js', () => ({
  createAIProvider: jest.fn().mockReturnValue({
    generate: jest.fn().mockResolvedValue('color-scheme'),
  }),
  AIProviderType: {
    ANTHROPIC: 'anthropic',
    OPENAI: 'openai',
  },
}));

describe('CLI frame command', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Spy on console.log to capture output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Save original environment
    originalEnv = { ...process.env };

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();

    // Restore environment
    process.env = originalEnv;
  });

  describe('frameCommand', () => {
    it('should output frame preview with default text', async () => {
      await frameCommand({});

      // Check that console.log was called with preview
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Vestaboard Frame Generator')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Input:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Preview:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Frame generated successfully')
      );
    });

    it('should use default text when none provided', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');

      await frameCommand({});

      expect(generateFrame).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'HELLO WORLD',
        })
      );
    });

    it('should use provided text', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');

      await frameCommand({ text: 'CUSTOM TEXT' });

      expect(generateFrame).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'CUSTOM TEXT',
        })
      );
    });

    it('should skip weather when --skip-weather set', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');

      await frameCommand({ skipWeather: true });

      expect(generateFrame).toHaveBeenCalledWith(
        expect.objectContaining({
          homeAssistant: undefined,
        })
      );
      expect(HomeAssistantClient).not.toHaveBeenCalled();
    });

    it('should skip colors when --skip-colors set', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');

      await frameCommand({ skipColors: true });

      expect(generateFrame).toHaveBeenCalledWith(
        expect.objectContaining({
          aiProvider: undefined,
        })
      );
      expect(createAIProvider).not.toHaveBeenCalled();
    });

    it('should display warnings when present', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');
      jest.mocked(generateFrame).mockResolvedValueOnce({
        layout: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        warnings: ['Text truncated', 'Weather unavailable'],
      });

      await frameCommand({});

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Warnings:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Text truncated'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Weather unavailable'));
    });

    it('should disconnect Home Assistant client on completion', async () => {
      process.env.HA_URL = 'http://localhost:8123';
      process.env.HA_TOKEN = 'test-token';

      await frameCommand({});

      const mockInstance = jest.mocked(HomeAssistantClient).mock.results[0]?.value;
      expect(mockInstance?.disconnect).toHaveBeenCalled();
    });

    it('should handle Home Assistant disconnect errors gracefully', async () => {
      process.env.HA_URL = 'http://localhost:8123';
      process.env.HA_TOKEN = 'test-token';

      const mockInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockRejectedValue(new Error('Disconnect failed')),
      };
      jest
        .mocked(HomeAssistantClient)
        .mockImplementationOnce(() => mockInstance as unknown as HomeAssistantClient);

      // Should not throw
      await expect(frameCommand({})).resolves.not.toThrow();
    });
  });

  describe('setupHomeAssistant', () => {
    it('should return undefined when HA_URL missing', async () => {
      delete process.env.HA_URL;
      delete process.env.HOME_ASSISTANT_URL;
      process.env.HA_TOKEN = 'test-token';

      await frameCommand({});

      expect(HomeAssistantClient).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No Home Assistant configured')
      );
    });

    it('should return undefined when HA_TOKEN missing', async () => {
      process.env.HA_URL = 'http://localhost:8123';
      delete process.env.HA_TOKEN;
      delete process.env.HOME_ASSISTANT_TOKEN;

      await frameCommand({});

      expect(HomeAssistantClient).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No Home Assistant configured')
      );
    });

    it('should use HOME_ASSISTANT_URL as fallback', async () => {
      delete process.env.HA_URL;
      process.env.HOME_ASSISTANT_URL = 'http://localhost:8123';
      process.env.HA_TOKEN = 'test-token';

      await frameCommand({});

      expect(HomeAssistantClient).toHaveBeenCalled();
    });

    it('should use HOME_ASSISTANT_TOKEN as fallback', async () => {
      process.env.HA_URL = 'http://localhost:8123';
      delete process.env.HA_TOKEN;
      process.env.HOME_ASSISTANT_TOKEN = 'test-token';

      await frameCommand({});

      expect(HomeAssistantClient).toHaveBeenCalled();
    });

    it('should handle Home Assistant connection failure gracefully', async () => {
      process.env.HA_URL = 'http://localhost:8123';
      process.env.HA_TOKEN = 'test-token';

      jest.mocked(HomeAssistantClient).mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      await frameCommand({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Home Assistant connection failed')
      );
    });
  });

  describe('setupAIProvider', () => {
    it('should return undefined when no API keys present', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      await frameCommand({});

      expect(createAIProvider).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No AI provider configured')
      );
    });

    it('should prefer Anthropic when both keys present', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      await frameCommand({});

      expect(createAIProvider).toHaveBeenCalledWith(AIProviderType.ANTHROPIC, 'test-anthropic-key');
    });

    it('should use OpenAI when Anthropic key missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.OPENAI_API_KEY = 'test-openai-key';

      await frameCommand({});

      expect(createAIProvider).toHaveBeenCalledWith(AIProviderType.OPENAI, 'test-openai-key');
    });

    it('should handle Anthropic setup failure and try OpenAI', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      jest
        .mocked(createAIProvider)
        .mockImplementationOnce(() => {
          throw new Error('Anthropic failed');
        })
        .mockReturnValueOnce({
          generate: jest.fn().mockResolvedValue('test'),
        } as ReturnType<typeof createAIProvider>);

      await frameCommand({});

      expect(createAIProvider).toHaveBeenCalledTimes(2);
      expect(createAIProvider).toHaveBeenNthCalledWith(
        1,
        AIProviderType.ANTHROPIC,
        'test-anthropic-key'
      );
      expect(createAIProvider).toHaveBeenNthCalledWith(2, AIProviderType.OPENAI, 'test-openai-key');
    });

    it('should handle all AI provider failures gracefully', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      jest.mocked(createAIProvider).mockImplementation(() => {
        throw new Error('Provider failed');
      });

      await frameCommand({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No AI provider configured')
      );
    });
  });

  describe('renderAsciiPreview', () => {
    it('should create correct border format', async () => {
      await frameCommand({});

      const previewCalls = consoleLogSpy.mock.calls
        .flat()
        .filter(call => typeof call === 'string' && call.includes('┌'));

      expect(previewCalls.length).toBeGreaterThan(0);
      const preview = previewCalls[0];
      expect(preview).toMatch(/┌─{22}┐/); // Top border
      expect(preview).toMatch(/└─{22}┘/); // Bottom border
      expect(preview).toMatch(/│.*│/); // Side borders
    });

    it('should render color blocks with ANSI codes', async () => {
      await frameCommand({});

      const previewCalls = consoleLogSpy.mock.calls
        .flat()
        .filter(call => typeof call === 'string' && call.includes('┌'));

      expect(previewCalls.length).toBeGreaterThan(0);
      const preview = previewCalls[0];
      // Should contain ANSI background color codes (e.g., \x1b[41m for red)
      expect(preview).toMatch(/\x1b\[\d+/);
    });
  });

  describe('character code conversion', () => {
    it('should convert letter codes correctly (A-Z)', async () => {
      await frameCommand({});

      const previewCalls = consoleLogSpy.mock.calls
        .flat()
        .filter(call => typeof call === 'string' && call.includes('HELLO'));

      expect(previewCalls.length).toBeGreaterThan(0);
      // The HELLO text should be rendered from codes [8,5,12,12,15]
      expect(previewCalls[0]).toContain('HELLO');
    });

    it('should convert blank code (0) to space', async () => {
      await frameCommand({});

      const previewCalls = consoleLogSpy.mock.calls
        .flat()
        .filter(call => typeof call === 'string' && call.includes('┌'));

      expect(previewCalls.length).toBeGreaterThan(0);
      const preview = previewCalls[0];
      // Rows with code 0 should render as spaces
      expect(preview).toMatch(/│\s+│/);
    });

    it('should convert number codes correctly (0-9)', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');
      jest.mocked(generateFrame).mockResolvedValueOnce({
        layout: [
          [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 1234567890
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
        warnings: [],
      });

      await frameCommand({});

      const previewCalls = consoleLogSpy.mock.calls
        .flat()
        .filter(call => typeof call === 'string' && call.includes('123'));

      expect(previewCalls.length).toBeGreaterThan(0);
      // Should render digits
      expect(previewCalls[0]).toMatch(/[0-9]+/);
    });
  });

  describe('verbose flag', () => {
    it('should not display timing when verbose is false', async () => {
      await frameCommand({ verbose: false });

      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Timing:'));
    });

    it('should not display timing when verbose is undefined', async () => {
      await frameCommand({});

      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Timing:'));
    });

    it('should display timing when verbose is true and timing data exists', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');
      jest.mocked(generateFrame).mockResolvedValueOnce({
        layout: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        warnings: [],
        timing: [
          { operation: 'ColorBarService.getColors()', durationMs: 100, cacheHit: false },
          { operation: 'Frame assembled', durationMs: 5 },
        ],
        totalMs: 105,
      });

      await frameCommand({ verbose: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Timing:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ColorBarService'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('CACHE MISS'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Total:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('105'));
    });

    it('should pass debug flag to generateFrame when verbose is true', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');

      await frameCommand({ verbose: true });

      expect(generateFrame).toHaveBeenCalledWith(expect.objectContaining({ debug: true }));
    });

    it('should not pass debug flag to generateFrame when verbose is false', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');

      await frameCommand({ verbose: false });

      expect(generateFrame).toHaveBeenCalledWith(expect.objectContaining({ debug: false }));
    });

    it('should display CACHE HIT when cacheHit is true', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');
      jest.mocked(generateFrame).mockResolvedValueOnce({
        layout: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        warnings: [],
        timing: [{ operation: 'ColorBarService.getColors()', durationMs: 5, cacheHit: true }],
        totalMs: 5,
      });

      await frameCommand({ verbose: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('CACHE HIT'));
    });

    it('should display timing without cache status when cacheHit is undefined', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');
      jest.mocked(generateFrame).mockResolvedValueOnce({
        layout: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        warnings: [],
        timing: [{ operation: 'WeatherService.getWeather()', durationMs: 156 }],
        totalMs: 156,
      });

      await frameCommand({ verbose: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('WeatherService'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('156'));
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('CACHE'));
    });

    it('should use correct tree characters for timing entries', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');
      jest.mocked(generateFrame).mockResolvedValueOnce({
        layout: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        warnings: [],
        timing: [
          { operation: 'ColorBarService.getColors()', durationMs: 2341, cacheHit: false },
          { operation: 'WeatherService.getWeather()', durationMs: 156 },
          { operation: 'formatInfoBar()', durationMs: 2 },
          { operation: 'Frame assembled', durationMs: 12 },
        ],
        totalMs: 2511,
      });

      await frameCommand({ verbose: true });

      // Should use ├─ for all entries except the last
      const logCalls = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(logCalls).toContain('├─ ColorBarService');
      expect(logCalls).toContain('├─ WeatherService');
      expect(logCalls).toContain('├─ formatInfoBar');
      // Last entry should use └─
      expect(logCalls).toContain('└─ Frame assembled');
    });

    it('should format numbers with locale string (thousands separator)', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');
      jest.mocked(generateFrame).mockResolvedValueOnce({
        layout: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        warnings: [],
        timing: [{ operation: 'ColorBarService.getColors()', durationMs: 2341, cacheHit: false }],
        totalMs: 2511,
      });

      await frameCommand({ verbose: true });

      // Should format 2341 with comma (2,341)
      const logCalls = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(logCalls).toMatch(/2,341|2\.341/); // Different locales use different separators
      expect(logCalls).toMatch(/2,511|2\.511/);
    });

    it('should not display timing when verbose is true but timing data is missing', async () => {
      const { generateFrame } = await import('../../../../src/content/frame/index.js');
      jest.mocked(generateFrame).mockResolvedValueOnce({
        layout: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        warnings: [],
      });

      await frameCommand({ verbose: true });

      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Timing:'));
    });
  });
});
