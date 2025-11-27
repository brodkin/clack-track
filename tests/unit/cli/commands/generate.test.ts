/**
 * Unit Tests for generate CLI Command
 *
 * Tests the generate command which uses ContentOrchestrator to create
 * and send content to Vestaboard.
 *
 * @module tests/unit/cli/commands/generate
 */

// Set minimal environment variables BEFORE any imports
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.VESTABOARD_API_KEY = 'test-vestaboard-key';
process.env.VESTABOARD_API_URL = 'http://localhost:7000';

import type { BootstrapResult } from '../../../../src/bootstrap.js';
import type { ContentOrchestrator } from '../../../../src/content/orchestrator.js';
import type { CronScheduler } from '../../../../src/scheduler/cron.js';

// Mock bootstrap module BEFORE importing the command
jest.mock('../../../../src/bootstrap.js');

// Now import modules
import { generateCommand } from '../../../../src/cli/commands/generate.js';
import * as bootstrapModule from '../../../../src/bootstrap.js';

// Mock console methods to capture output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock process.exit to prevent test termination
jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`process.exit(${code})`);
});

describe('generate command', () => {
  let bootstrapSpy: jest.SpyInstance;
  let mockOrchestrator: jest.Mocked<ContentOrchestrator>;
  let mockScheduler: jest.Mocked<CronScheduler>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock orchestrator
    mockOrchestrator = {
      generateAndSend: jest.fn().mockResolvedValue(undefined),
      getCachedContent: jest.fn().mockReturnValue(null),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<ContentOrchestrator>;

    // Create mock scheduler
    mockScheduler = {
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as jest.Mocked<CronScheduler>;

    // Mock bootstrap function
    bootstrapSpy = jest.spyOn(bootstrapModule, 'bootstrap').mockResolvedValue({
      orchestrator: mockOrchestrator,
      eventHandler: null,
      scheduler: mockScheduler,
      registry: {} as BootstrapResult['registry'],
    } as BootstrapResult);
  });

  afterEach(() => {
    bootstrapSpy.mockRestore();
  });

  describe('Major Update Generation', () => {
    it('should generate major update when type is "major"', async () => {
      await generateCommand({ type: 'major' });

      expect(bootstrapSpy).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          updateType: 'major',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should generate major update when type is undefined (default)', async () => {
      await generateCommand({});

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          updateType: 'major',
        })
      );
    });

    it('should log start message for major update', async () => {
      await generateCommand({ type: 'major' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Generating major content update')
      );
    });

    it('should log success message after major update completes', async () => {
      await generateCommand({ type: 'major' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated and sent major update')
      );
    });
  });

  describe('Minor Update Generation', () => {
    it('should generate minor update when type is "minor"', async () => {
      await generateCommand({ type: 'minor' });

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          updateType: 'minor',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should log start message for minor update', async () => {
      await generateCommand({ type: 'minor' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Generating minor content update')
      );
    });

    it('should log success message after minor update completes', async () => {
      await generateCommand({ type: 'minor' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated and sent minor update')
      );
    });
  });

  describe('Scheduler Shutdown', () => {
    it('should stop scheduler after successful generation', async () => {
      await generateCommand({ type: 'major' });

      expect(mockScheduler.stop).toHaveBeenCalledTimes(1);
    });

    it('should stop scheduler even if generation throws error', async () => {
      mockOrchestrator.generateAndSend.mockRejectedValueOnce(new Error('Generation failed'));

      await expect(async () => {
        await generateCommand({ type: 'major' });
      }).rejects.toThrow('process.exit(1)');

      expect(mockScheduler.stop).toHaveBeenCalledTimes(1);
    });

    it('should stop scheduler even if bootstrap throws error', async () => {
      bootstrapSpy.mockRejectedValueOnce(new Error('Bootstrap failed'));

      await expect(async () => {
        await generateCommand({ type: 'major' });
      }).rejects.toThrow('process.exit(1)');

      expect(mockScheduler.stop).toHaveBeenCalledTimes(0); // No scheduler if bootstrap fails
    });
  });

  describe('Error Handling', () => {
    it('should handle bootstrap errors and exit with code 1', async () => {
      const error = new Error('Bootstrap initialization failed');
      bootstrapSpy.mockRejectedValueOnce(error);

      await expect(async () => {
        await generateCommand({ type: 'major' });
      }).rejects.toThrow('process.exit(1)');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate content'),
        error
      );
    });

    it('should handle orchestrator errors and exit with code 1', async () => {
      const error = new Error('No generator available');
      mockOrchestrator.generateAndSend.mockRejectedValueOnce(error);

      await expect(async () => {
        await generateCommand({ type: 'major' });
      }).rejects.toThrow('process.exit(1)');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate content'),
        error
      );
    });

    it('should handle scheduler stop errors gracefully', async () => {
      const stopError = new Error('Scheduler stop failed');
      mockScheduler.stop.mockImplementationOnce(() => {
        throw stopError;
      });

      // Should not throw because scheduler.stop errors are caught
      await generateCommand({ type: 'major' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated')
      );
    });

    it('should display meaningful error for Vestaboard send failures', async () => {
      const error = new Error('Vestaboard API connection failed');
      mockOrchestrator.generateAndSend.mockRejectedValueOnce(error);

      await expect(async () => {
        await generateCommand({ type: 'major' });
      }).rejects.toThrow('process.exit(1)');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate content'),
        error
      );
    });
  });

  describe('Bootstrap Integration', () => {
    it('should call bootstrap exactly once per command execution', async () => {
      await generateCommand({ type: 'major' });

      expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    });

    it('should use orchestrator from bootstrap result', async () => {
      await generateCommand({ type: 'major' });

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledTimes(1);
    });

    it('should use scheduler from bootstrap result', async () => {
      await generateCommand({ type: 'major' });

      expect(mockScheduler.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timestamp Handling', () => {
    it('should pass current timestamp to orchestrator', async () => {
      const beforeTime = new Date();
      await generateCommand({ type: 'major' });
      const afterTime = new Date();

      const call = mockOrchestrator.generateAndSend.mock.calls[0][0];
      const timestamp = call.timestamp;

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should use fresh timestamp for each command execution', async () => {
      await generateCommand({ type: 'major' });
      const firstTimestamp = mockOrchestrator.generateAndSend.mock.calls[0][0].timestamp;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      mockOrchestrator.generateAndSend.mockClear();
      await generateCommand({ type: 'major' });
      const secondTimestamp = mockOrchestrator.generateAndSend.mock.calls[0][0].timestamp;

      expect(secondTimestamp.getTime()).toBeGreaterThan(firstTimestamp.getTime());
    });
  });

  describe('Type Validation', () => {
    it('should accept "major" type option', async () => {
      await expect(generateCommand({ type: 'major' })).resolves.toBeUndefined();
    });

    it('should accept "minor" type option', async () => {
      await expect(generateCommand({ type: 'minor' })).resolves.toBeUndefined();
    });

    it('should accept undefined type (defaults to major)', async () => {
      await expect(generateCommand({})).resolves.toBeUndefined();
    });

    it('should handle type option with correct context structure', async () => {
      await generateCommand({ type: 'minor' });

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith({
        updateType: 'minor',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Console Output Format', () => {
    it('should display update type in start message', async () => {
      await generateCommand({ type: 'minor' });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/minor content update/i));
    });

    it('should display update type in success message', async () => {
      await generateCommand({ type: 'minor' });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/minor update/i));
    });

    it('should include error details in error messages', async () => {
      const detailedError = new Error('Detailed failure reason');
      mockOrchestrator.generateAndSend.mockRejectedValueOnce(detailedError);

      await expect(async () => {
        await generateCommand({ type: 'major' });
      }).rejects.toThrow('process.exit(1)');

      expect(mockConsoleError).toHaveBeenCalledWith(expect.any(String), detailedError);
    });
  });
});
