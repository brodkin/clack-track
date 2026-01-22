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
  dbMigrateCommand: jest.fn().mockResolvedValue(undefined),
  dbResetCommand: jest.fn().mockResolvedValue(undefined),
  contentListCommand: jest.fn().mockResolvedValue(undefined),
  contentTestCommand: jest.fn().mockResolvedValue(undefined),
  circuitStatusCommand: jest.fn().mockResolvedValue(undefined),
  circuitOnCommand: jest.fn().mockResolvedValue(undefined),
  circuitOffCommand: jest.fn().mockResolvedValue(undefined),
  circuitResetCommand: jest.fn().mockResolvedValue(undefined),
  circuitWatchCommand: jest.fn().mockResolvedValue(undefined),
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

      // Verify skipWeather is parsed as boolean true, not a string
      expect(jest.mocked(frameCommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          skipWeather: true,
        })
      );
    });

    it('should parse --skip-colors as boolean true', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      await runCLI(['node', 'script.js', 'frame', '--skip-colors']);

      // Verify skipColors is parsed as boolean true, not a string
      expect(jest.mocked(frameCommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          skipColors: true,
        })
      );
    });

    it('should parse --verbose as boolean true', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      await runCLI(['node', 'script.js', 'frame', '--verbose']);

      // Verify verbose is parsed as boolean true, not a string
      expect(jest.mocked(frameCommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          verbose: true,
        })
      );
    });

    it('should not capture following positional argument as boolean value', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // --skip-weather TEST should parse as: skipWeather=true, text='TEST'
      await runCLI(['node', 'script.js', 'frame', '--skip-weather', 'TEST']);

      // Verify skipWeather is boolean true and text is captured as positional arg
      expect(jest.mocked(frameCommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          skipWeather: true,
          text: 'TEST',
        })
      );
    });

    it('should handle multiple boolean flags without capturing positional args as values', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // Multiple boolean flags followed by positional text
      await runCLI(['node', 'script.js', 'frame', '--skip-weather', '--skip-colors', 'TEXT']);

      // Verify both flags are boolean true and text is captured
      expect(jest.mocked(frameCommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          skipWeather: true,
          skipColors: true,
          text: 'TEXT',
        })
      );
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

      // --skip-weather HELLO should parse as: skipWeather=true, text='HELLO'
      await runCLI(['node', 'script.js', 'frame', '--skip-weather', 'HELLO', 'WORLD']);

      // Verify skipWeather is boolean true and first positional arg is captured as text
      expect(jest.mocked(frameCommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          skipWeather: true,
          text: 'HELLO',
        })
      );
    });

    it('should handle positional argument at start of arg list', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // TEXT --skip-weather should parse as: text='TEXT', skipWeather=true
      await runCLI(['node', 'script.js', 'frame', 'TEXT', '--skip-weather']);

      expect(jest.mocked(frameCommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'TEXT',
          skipWeather: true,
        })
      );
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

  describe('Database commands', () => {
    it('should route db:migrate to dbMigrateCommand', async () => {
      const { dbMigrateCommand } = await import('../../../src/cli/commands/index.js');
      jest.mocked(dbMigrateCommand).mockClear();

      // Simulate: node dist/cli/index.js db:migrate
      await runCLI(['node', 'script.js', 'db:migrate']);

      expect(jest.mocked(dbMigrateCommand)).toHaveBeenCalledTimes(1);
    });

    it('should route db:reset to dbResetCommand', async () => {
      const { dbResetCommand } = await import('../../../src/cli/commands/index.js');
      jest.mocked(dbResetCommand).mockClear();

      // Simulate: node dist/cli/index.js db:reset --force
      await runCLI(['node', 'script.js', 'db:reset', '--force']);

      expect(jest.mocked(dbResetCommand)).toHaveBeenCalledTimes(1);
      expect(jest.mocked(dbResetCommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          force: true,
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle flag at end of arguments', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // TEXT --skip-weather should parse as: text='TEXT', skipWeather=true
      await runCLI(['node', 'script.js', 'frame', 'TEXT', '--skip-weather']);

      expect(jest.mocked(frameCommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'TEXT',
          skipWeather: true,
        })
      );
    });

    it('should handle multiple consecutive flags', async () => {
      const { frameCommand } = await import('../../../src/cli/commands/frame.js');
      jest.mocked(frameCommand).mockClear();

      // Multiple consecutive flags followed by positional text
      await runCLI([
        'node',
        'script.js',
        'frame',
        '--skip-weather',
        '--skip-colors',
        '--verbose',
        'TEXT',
      ]);

      expect(jest.mocked(frameCommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          skipWeather: true,
          skipColors: true,
          verbose: true,
          text: 'TEXT',
        })
      );
    });

    it('should handle value flag followed by another flag (no explicit value)', async () => {
      const { testAICommand } = await import('../../../src/cli/commands/index.js');
      jest.mocked(testAICommand).mockClear();

      // When --prompt is immediately followed by --provider, the parser
      // recognizes --provider as a flag (starts with --), so --prompt gets
      // value=true instead of consuming the next argument
      await runCLI(['node', 'script.js', 'test-ai', '--prompt', '--provider', 'openai']);

      // Verify both flags are parsed correctly:
      // - --prompt becomes true (no explicit string value, next arg is a flag)
      // - --provider gets 'openai' as its value
      expect(jest.mocked(testAICommand)).toHaveBeenCalledWith(
        expect.objectContaining({
          customPrompt: undefined, // --prompt set to true, not a string, so defaults to undefined
          provider: 'openai', // --provider correctly parsed with its value
        })
      );
    });
  });
});
