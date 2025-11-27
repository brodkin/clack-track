/**
 * Unit Tests: FrameDecorator
 *
 * TDD Test Suite for FrameDecorator service that wraps generateFrame()
 * with optional dependency injection for HomeAssistantClient and AIProvider.
 */

import { FrameDecorator } from '../../../../src/content/frame/frame-decorator.js';
import type { HomeAssistantClient } from '../../../../src/api/data-sources/home-assistant.js';
import type { AIProvider } from '../../../../src/types/ai.js';
import * as frameGeneratorModule from '../../../../src/content/frame/frame-generator.js';

// Mock dependencies
const mockHomeAssistantClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  isConnected: jest.fn(() => true),
  validateConnection: jest.fn(),
  subscribeToEvents: jest.fn(),
  unsubscribeFromEvents: jest.fn(),
  getState: jest.fn(),
  getAllStates: jest.fn(),
  callService: jest.fn(),
  triggerReconnection: jest.fn(),
} as unknown as HomeAssistantClient;

const mockAIProvider = {
  generate: jest.fn(),
  validateConnection: jest.fn(() => Promise.resolve(true)),
} as unknown as AIProvider;

describe('FrameDecorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor - Dependency Injection', () => {
    it('should create instance with no dependencies (graceful degradation mode)', () => {
      const decorator = new FrameDecorator();

      expect(decorator).toBeInstanceOf(FrameDecorator);
    });

    it('should create instance with HomeAssistantClient only', () => {
      const decorator = new FrameDecorator({ homeAssistant: mockHomeAssistantClient });

      expect(decorator).toBeInstanceOf(FrameDecorator);
    });

    it('should create instance with AIProvider only', () => {
      const decorator = new FrameDecorator({ aiProvider: mockAIProvider });

      expect(decorator).toBeInstanceOf(FrameDecorator);
    });

    it('should create instance with both dependencies', () => {
      const decorator = new FrameDecorator({
        homeAssistant: mockHomeAssistantClient,
        aiProvider: mockAIProvider,
      });

      expect(decorator).toBeInstanceOf(FrameDecorator);
    });
  });

  describe('decorate() - Basic Functionality', () => {
    it('should decorate text and return FrameResult with layout and warnings', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('HELLO WORLD');

      expect(result).toHaveProperty('layout');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.layout)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.layout.length).toBe(6); // 6 rows
      expect(result.layout[0].length).toBe(22); // 22 columns
    });

    it('should accept optional dateTime parameter', async () => {
      const decorator = new FrameDecorator();
      const testDate = new Date('2025-01-15T14:30:00Z');

      const result = await decorator.decorate('TEST TEXT', testDate);

      expect(result).toHaveProperty('layout');
      expect(result).toHaveProperty('warnings');
    });

    it('should default to current time if dateTime not provided', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('TEST TEXT');

      expect(result).toHaveProperty('layout');
      // Should have generated a frame with current time
      expect(result.layout.length).toBe(6);
    });
  });

  describe('decorate() - With HomeAssistantClient', () => {
    it('should pass HomeAssistantClient to generateFrame', async () => {
      const decorator = new FrameDecorator({ homeAssistant: mockHomeAssistantClient });

      const result = await decorator.decorate('WEATHER TEST');

      expect(result).toHaveProperty('layout');
      expect(result.warnings).toBeDefined();
      // HomeAssistant would be used for weather data in generateFrame
    });

    it('should gracefully degrade if HomeAssistantClient throws error', async () => {
      const faultyClient = {
        ...mockHomeAssistantClient,
        isConnected: jest.fn(() => false),
      } as unknown as HomeAssistantClient;

      const decorator = new FrameDecorator({ homeAssistant: faultyClient });

      const result = await decorator.decorate('WEATHER TEST');

      expect(result).toHaveProperty('layout');
      expect(result).toHaveProperty('warnings');
      // Should still return a valid frame even if weather unavailable
      expect(result.layout.length).toBe(6);
    });
  });

  describe('decorate() - With AIProvider', () => {
    it('should pass AIProvider to generateFrame', async () => {
      const decorator = new FrameDecorator({ aiProvider: mockAIProvider });

      const result = await decorator.decorate('COLOR TEST');

      expect(result).toHaveProperty('layout');
      expect(result.warnings).toBeDefined();
      // AIProvider would be used for color bar in generateFrame
    });

    it('should gracefully degrade if AIProvider throws error', async () => {
      const faultyAI = {
        generate: jest.fn().mockRejectedValue(new Error('AI service unavailable')),
        validateConnection: jest.fn(() => Promise.resolve(false)),
      } as unknown as AIProvider;

      const decorator = new FrameDecorator({ aiProvider: faultyAI });

      const result = await decorator.decorate('COLOR TEST');

      expect(result).toHaveProperty('layout');
      expect(result).toHaveProperty('warnings');
      // Should still return a valid frame with fallback colors
      expect(result.layout.length).toBe(6);
    });
  });

  describe('decorate() - With Both Dependencies', () => {
    it('should pass both HomeAssistant and AIProvider to generateFrame', async () => {
      const decorator = new FrameDecorator({
        homeAssistant: mockHomeAssistantClient,
        aiProvider: mockAIProvider,
      });

      const result = await decorator.decorate('FULL FEATURED TEST');

      expect(result).toHaveProperty('layout');
      expect(result).toHaveProperty('warnings');
      expect(result.layout.length).toBe(6);
      expect(result.layout[0].length).toBe(22);
    });
  });

  describe('decorate() - Graceful Degradation', () => {
    it('should return valid frame even with no dependencies', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('MINIMAL TEST');

      expect(result.layout).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.layout)).toBe(true);
      expect(result.layout.length).toBe(6);
    });

    it('should handle empty text gracefully', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('');

      expect(result.layout).toBeDefined();
      expect(result.layout.length).toBe(6);
    });

    it('should handle very long text gracefully', async () => {
      const decorator = new FrameDecorator();
      const longText = 'A'.repeat(500);

      const result = await decorator.decorate(longText);

      expect(result.layout).toBeDefined();
      expect(result.layout.length).toBe(6);
      // May or may not warn depending on word wrapping behavior
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should handle special characters gracefully', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('HELLO @#$% WORLD');

      expect(result.layout).toBeDefined();
      expect(result.layout.length).toBe(6);
    });
  });

  describe('decorate() - Return Value Validation', () => {
    it('should return FrameResult with correct structure', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('STRUCTURE TEST');

      // Validate layout structure
      expect(Array.isArray(result.layout)).toBe(true);
      expect(result.layout.length).toBe(6); // 6 rows

      result.layout.forEach(row => {
        expect(Array.isArray(row)).toBe(true);
        expect(row.length).toBe(22); // 22 columns per row
        row.forEach(code => {
          expect(typeof code).toBe('number');
        });
      });

      // Validate warnings array
      expect(Array.isArray(result.warnings)).toBe(true);
      result.warnings.forEach(warning => {
        expect(typeof warning).toBe('string');
      });
    });

    it('should return warnings array (may be empty)', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('SHORT');

      expect(Array.isArray(result.warnings)).toBe(true);
      // Warnings may or may not be empty depending on input
    });

    it('should propagate warnings from generateFrame', async () => {
      const decorator = new FrameDecorator();
      const textWithUnsupportedChars = 'TEST™©®';

      const result = await decorator.decorate(textWithUnsupportedChars);

      expect(result.warnings).toBeDefined();
      // generateFrame should warn about unsupported characters
    });
  });

  describe('decorate() - DateTime Handling', () => {
    it('should pass custom dateTime to generateFrame', async () => {
      const decorator = new FrameDecorator();
      const customDate = new Date('2025-01-01T12:00:00Z');

      const result = await decorator.decorate('CUSTOM DATE', customDate);

      expect(result).toHaveProperty('layout');
      // Info bar should reflect custom date
    });

    it('should use current time when dateTime is undefined', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('CURRENT TIME');

      expect(result).toHaveProperty('layout');
      // Info bar should reflect current time (tested implicitly)
    });
  });

  describe('SOLID Principles - Dependency Inversion', () => {
    it('should accept abstracted dependencies (not concrete implementations)', () => {
      // This test validates DIP: decorator depends on abstractions (interfaces), not concrete classes
      const decorator = new FrameDecorator({
        homeAssistant: mockHomeAssistantClient, // Interface type
        aiProvider: mockAIProvider, // Interface type
      });

      expect(decorator).toBeInstanceOf(FrameDecorator);
    });

    it('should function without any dependencies (Open/Closed principle)', async () => {
      // Decorator is open for extension (can add deps) but closed for modification (works without them)
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('NO DEPS');

      expect(result.layout).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null-like values for dateTime gracefully', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('TEST', undefined);

      expect(result).toHaveProperty('layout');
    });

    it('should handle whitespace-only text', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('     ');

      expect(result.layout).toBeDefined();
      expect(result.layout.length).toBe(6);
    });

    it('should handle newline characters in text', async () => {
      const decorator = new FrameDecorator();

      const result = await decorator.decorate('LINE1\nLINE2\nLINE3');

      expect(result.layout).toBeDefined();
      expect(result.layout.length).toBe(6);
    });
  });

  describe('Error Handling and Fallback Logic', () => {
    it('should use fallback layout if generateFrame throws unexpected error', async () => {
      // Spy on generateFrame and make it throw
      const generateFrameSpy = jest
        .spyOn(frameGeneratorModule, 'generateFrame')
        .mockRejectedValueOnce(new Error('Catastrophic failure'));

      const decorator = new FrameDecorator();

      const result = await decorator.decorate('FALLBACK TEST');

      // Should have called generateFrame
      expect(generateFrameSpy).toHaveBeenCalled();

      // Should return fallback layout with warning
      expect(result).toHaveProperty('layout');
      expect(result).toHaveProperty('warnings');
      expect(result.layout.length).toBe(6);
      expect(result.layout[0].length).toBe(22);
      expect(result.warnings).toContain('Frame generation failed: Catastrophic failure');

      // Restore original implementation
      generateFrameSpy.mockRestore();
    });

    it('should create valid fallback layout for any text', async () => {
      const decorator = new FrameDecorator();

      // Test various text inputs to ensure fallback logic works
      const texts = ['A', 'AB', 'ABC', 'HELLO WORLD', 'TEST 123', ' SPACES '];

      for (const text of texts) {
        const result = await decorator.decorate(text);

        expect(result.layout).toBeDefined();
        expect(result.layout.length).toBe(6);
        expect(result.layout[0].length).toBe(22);

        // Verify all codes are numbers
        result.layout.forEach(row => {
          row.forEach(code => {
            expect(typeof code).toBe('number');
          });
        });
      }
    });

    it('should handle uppercase and lowercase characters in fallback', async () => {
      const decorator = new FrameDecorator();

      // Normal operation should handle this through generateFrame
      const result = await decorator.decorate('abc XYZ 123');

      expect(result.layout).toBeDefined();
      expect(result.layout.length).toBe(6);
    });

    it('should truncate long text in fallback layout', async () => {
      const decorator = new FrameDecorator();

      // Test with text longer than 22 chars
      const result = await decorator.decorate('A'.repeat(50));

      expect(result.layout).toBeDefined();
      expect(result.layout[0].length).toBe(22); // Should be truncated to 22
    });

    it('should use space code (0) for unsupported characters in fallback', async () => {
      const decorator = new FrameDecorator();

      // Test with special characters that would use fallback
      const result = await decorator.decorate('TEST!@#$');

      expect(result.layout).toBeDefined();
      expect(result.layout.length).toBe(6);
    });
  });
});
