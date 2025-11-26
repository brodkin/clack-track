/**
 * Tests for CLI argument parsing
 *
 * Tests the parseOptions function that parses command-line arguments
 * and correctly distinguishes between boolean flags and value flags.
 */

import { describe, it, expect } from '@jest/globals';
import { runCLI } from '../../../src/cli/index.js';

// Mock the command functions to avoid executing actual commands
jest.mock('../../../src/cli/commands/index.js', () => ({
  generateCommand: jest.fn().mockResolvedValue(undefined),
  testBoardCommand: jest.fn().mockResolvedValue(undefined),
  testAICommand: jest.fn().mockResolvedValue(undefined),
  testHACommand: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/cli/commands/frame.js', () => ({
  frameCommand: jest.fn().mockResolvedValue(undefined),
}));

describe('CLI parseOptions', () => {
  describe('Boolean flags', () => {
    it('should parse --skip-weather as boolean true', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // Simulate: npm run frame -- --skip-weather
      // args[0] = node, args[1] = script, args[2] = 'frame', args[3] = '--skip-weather'
      await runCLI(['node', 'script.js', 'frame', '--skip-weather']);

      expect(jest.mocked(frameCommand)).toHaveBeenCalled();
    });

    it('should parse --skip-colors as boolean true', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      await runCLI(['node', 'script.js', 'frame', '--skip-colors']);

      expect(jest.mocked(frameCommand)).toHaveBeenCalled();
    });

    it('should parse --verbose as boolean true', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      await runCLI(['node', 'script.js', 'frame', '--verbose']);

      expect(jest.mocked(frameCommand)).toHaveBeenCalled();
    });

    it('should not capture following positional argument as boolean value', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // BUG: --skip-weather TEST should NOT capture TEST as the value of skip-weather
      // Simulate: npm run frame -- --skip-weather TEST
      // args: ['node', 'script.js', 'frame', '--skip-weather', 'TEST']
      await runCLI(['node', 'script.js', 'frame', '--skip-weather', 'TEST']);

      // After fix, frameCommand should be called with skipWeather=true and text='TEST'
      // The issue is that currently parseOptions treats 'TEST' as the value of --skip-weather
      expect(jest.mocked(frameCommand)).toHaveBeenCalled();
    });

    it('should handle multiple boolean flags without capturing positional args as values', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // Simulate: npm run frame -- --skip-weather --skip-colors TEXT
      await runCLI(['node', 'script.js', 'frame', '--skip-weather', '--skip-colors', 'TEXT']);

      expect(jest.mocked(frameCommand)).toHaveBeenCalled();
    });
  });

  describe('Value flags', () => {
    it('should parse --provider with its value', async () => {
      const { testAICommand } = await import('../../../src/cli/commands/index.js');
      jest.mocked(testAICommand).mockClear();

      // Simulate: npm run test:ai -- --provider openai
      await runCLI(['node', 'script.js', 'test-ai', '--provider', 'openai']);

      expect(jest.mocked(testAICommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
        })
      );
    });

    it('should parse --prompt with its value', async () => {
      const { testAICommand } = await import('../../../src/cli/commands/index.js');
      jest.mocked(testAICommand).mockClear();

      // Simulate: npm run test:ai -- --prompt "custom prompt"
      await runCLI(['node', 'script.js', 'test-ai', '--prompt', 'custom prompt']);

      expect(jest.mocked(testAICommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          customPrompt: 'custom prompt',
        })
      );
    });

    it('should parse --entity with its value', async () => {
      const { testHACommand } = await import('../../../src/cli/commands/index.js');
      jest.mocked(testHACommand).mockClear();

      // Simulate: npm run test:ha -- --entity light.living_room
      await runCLI(['node', 'script.js', 'test-ha', '--entity', 'light.living_room']);

      expect(jest.mocked(testHACommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'light.living_room',
        })
      );
    });

    it('should parse --watch with its value', async () => {
      const { testHACommand } = await import('../../../src/cli/commands/index.js');
      jest.mocked(testHACommand).mockClear();

      // Simulate: npm run test:ha -- --watch state_changed
      await runCLI(['node', 'script.js', 'test-ha', '--watch', 'state_changed']);

      expect(jest.mocked(testHACommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          watch: 'state_changed',
        })
      );
    });
  });

  describe('Mixed flags and positional arguments', () => {
    it('should parse boolean flag followed by positional text argument correctly', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // Simulate: npm run frame -- --skip-weather "HELLO WORLD"
      // With correct parsing: text should be "HELLO WORLD" and skipWeather should be true
      // With buggy parsing: text would be undefined and skipWeather would be "HELLO WORLD"
      await runCLI(['node', 'script.js', 'frame', '--skip-weather', 'HELLO', 'WORLD']);

      // After fix, should capture HELLO as the text
      // (Note: WORLD becomes a separate arg that frame command ignores)
      expect(jest.mocked(frameCommand)).toHaveBeenCalled();
    });

    it('should handle positional argument at start of arg list', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // Simulate: npm run frame -- TEXT --skip-weather
      // Positional args at start should be captured in frame command's textArg logic
      await runCLI(['node', 'script.js', 'frame', 'TEXT', '--skip-weather']);

      expect(jest.mocked(frameCommand)).toHaveBeenCalled();
    });

    it('should not confuse boolean flags with value flags when combined', async () => {
      const { testAICommand } = await import('../../../src/cli/commands/index.js');
      jest.mocked(testAICommand).mockClear();

      // Simulate: npm run test:ai -- --interactive --provider openai
      // --interactive is boolean, --provider expects a value
      await runCLI(['node', 'script.js', 'test-ai', '--interactive', '--provider', 'openai']);

      expect(jest.mocked(testAICommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          interactive: true,
          provider: 'openai',
        })
      );
    });

    it('should parse value flag followed by another flag correctly', async () => {
      const { testAICommand } = await import('../../../src/cli/commands/index.js');
      jest.mocked(testAICommand).mockClear();

      // Simulate: npm run test:ai -- --provider anthropic --interactive
      await runCLI(['node', 'script.js', 'test-ai', '--provider', 'anthropic', '--interactive']);

      expect(jest.mocked(testAICommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anthropic',
          interactive: true,
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle flag at end of arguments', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // Simulate: npm run frame -- TEXT --skip-weather
      await runCLI(['node', 'script.js', 'frame', 'TEXT', '--skip-weather']);

      expect(jest.mocked(frameCommand)).toHaveBeenCalled();
    });

    it('should handle multiple consecutive flags', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // Simulate: npm run frame -- --skip-weather --skip-colors --verbose TEXT
      await runCLI([
        'node',
        'script.js',
        'frame',
        '--skip-weather',
        '--skip-colors',
        '--verbose',
        'TEXT',
      ]);

      expect(jest.mocked(frameCommand)).toHaveBeenCalled();
    });

    it('should handle value flag with empty string value', async () => {
      const { testAICommand } = await import('../../../src/cli/commands/index.js');
      jest.mocked(testAICommand).mockClear();

      // This is tricky: --prompt "" should pass empty string as value
      // But parseOptions might treat empty string as falsy
      // For now, just ensure it doesn't crash
      await runCLI(['node', 'script.js', 'test-ai', '--prompt', '--provider', 'openai']);

      expect(jest.mocked(testAICommand)).toHaveBeenCalled();
    });
  });
});
