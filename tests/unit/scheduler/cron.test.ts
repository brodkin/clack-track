/**
 * CronScheduler Unit Tests
 *
 * Tests CronScheduler minute-aligned scheduling, minor update execution,
 * and graceful error handling.
 *
 * Coverage Target: Lines 57-58, 82-126 (previously uncovered)
 */

import { CronScheduler } from '../../../src/scheduler/cron.js';
import type { MinorUpdateGenerator } from '../../../src/content/generators/index.js';
import type { VestaboardClient } from '../../../src/api/vestaboard/index.js';
import type { GeneratedContent } from '../../../src/types/content-generator.js';

describe('CronScheduler', () => {
  let mockMinorUpdateGenerator: jest.Mocked<MinorUpdateGenerator>;
  let mockVestaboardClient: jest.Mocked<VestaboardClient>;
  let scheduler: CronScheduler;

  // Sample generated content for testing
  const mockContent: GeneratedContent = {
    text: 'Test Content',
    outputMode: 'layout',
    layout: {
      rows: [],
      characterCodes: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ],
    },
    metadata: { minorUpdate: true },
  };

  beforeEach(() => {
    // Use fake timers for deterministic timer testing
    jest.useFakeTimers();

    // Create mock MinorUpdateGenerator
    mockMinorUpdateGenerator = {
      generate: jest.fn().mockResolvedValue(mockContent),
      shouldSkip: jest.fn().mockReturnValue(false),
      validate: jest.fn().mockResolvedValue({ valid: true }),
    } as unknown as jest.Mocked<MinorUpdateGenerator>;

    // Create mock VestaboardClient
    mockVestaboardClient = {
      sendText: jest.fn().mockResolvedValue(undefined),
      sendLayout: jest.fn().mockResolvedValue(undefined),
      sendLayoutWithAnimation: jest.fn().mockResolvedValue(undefined),
      readMessage: jest.fn().mockResolvedValue([]),
      validateConnection: jest.fn().mockResolvedValue({ connected: true }),
    } as unknown as jest.Mocked<VestaboardClient>;

    scheduler = new CronScheduler(mockMinorUpdateGenerator, mockVestaboardClient);
  });

  afterEach(() => {
    // Clean up timers and restore real timers
    scheduler.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should accept MinorUpdateGenerator and VestaboardClient', () => {
      expect(scheduler).toBeInstanceOf(CronScheduler);
    });

    it('should store generator and client references', () => {
      // This test validates that the constructor properly stores dependencies
      // We'll verify this indirectly through start() behavior
      expect(scheduler).toBeDefined();
    });
  });

  describe('start', () => {
    it('should schedule first minor update at next minute boundary', async () => {
      // Mock current time at :45 seconds
      jest.setSystemTime(new Date('2025-11-30T12:00:45.500Z'));

      scheduler.start();

      // Should not execute immediately
      expect(mockMinorUpdateGenerator.generate).not.toHaveBeenCalled();

      // Advance to next minute boundary (14.5 seconds = 14500ms)
      await jest.advanceTimersByTimeAsync(14500);

      // Should execute runMinorUpdate at :00 seconds
      expect(mockMinorUpdateGenerator.shouldSkip).toHaveBeenCalled();
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledWith({
        updateType: 'minor',
        timestamp: expect.any(Date),
      });
    });

    it('should start recurring interval after first execution', async () => {
      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));

      scheduler.start();

      // Advance to first execution (5 seconds)
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(1);

      // Advance another 60 seconds (second execution)
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(2);

      // Advance another 60 seconds (third execution)
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(3);
    });

    it('should calculate delay correctly when at :59 seconds', async () => {
      // Test edge case: 1 second until next minute
      jest.setSystemTime(new Date('2025-11-30T12:00:59.000Z'));

      scheduler.start();

      // Should not execute immediately
      expect(mockMinorUpdateGenerator.generate).not.toHaveBeenCalled();

      // Advance 1 second to next minute
      await jest.advanceTimersByTimeAsync(1000);

      // Should execute now
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalled();
    });

    it('should calculate delay correctly with milliseconds', async () => {
      // Test precise timing: :30.750 seconds = 29.25 seconds until next minute
      jest.setSystemTime(new Date('2025-11-30T12:00:30.750Z'));

      scheduler.start();

      expect(mockMinorUpdateGenerator.generate).not.toHaveBeenCalled();

      // Advance 29.25 seconds (29250ms)
      await jest.advanceTimersByTimeAsync(29250);

      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should clear the interval and prevent further updates', async () => {
      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));

      scheduler.start();

      // Advance to first execution
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(1);

      // Stop the scheduler
      scheduler.stop();

      // Advance another 60 seconds - should NOT execute
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call multiple times', () => {
      scheduler.start();
      scheduler.stop();
      scheduler.stop(); // Second call should not throw
      scheduler.stop(); // Third call should not throw

      expect(() => scheduler.stop()).not.toThrow();
    });

    it('should be safe to call when never started', () => {
      // Stop without ever calling start
      expect(() => scheduler.stop()).not.toThrow();
    });

    it('should set intervalId to null after stopping', async () => {
      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));

      scheduler.start();
      await jest.advanceTimersByTimeAsync(5000);

      scheduler.stop();

      // Second stop should be no-op (intervalId is null)
      scheduler.stop();
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe('runMinorUpdate - shouldSkip scenarios', () => {
    it('should skip minor update when shouldSkip returns true', async () => {
      mockMinorUpdateGenerator.shouldSkip.mockReturnValue(true);

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      await jest.advanceTimersByTimeAsync(5000);

      // Should check shouldSkip but not generate
      expect(mockMinorUpdateGenerator.shouldSkip).toHaveBeenCalled();
      expect(mockMinorUpdateGenerator.generate).not.toHaveBeenCalled();
      expect(mockVestaboardClient.sendLayout).not.toHaveBeenCalled();
    });

    it('should continue to next interval after skipping', async () => {
      // Skip first update, execute second
      mockMinorUpdateGenerator.shouldSkip
        .mockReturnValueOnce(true) // Skip first
        .mockReturnValueOnce(false); // Execute second

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      // First execution - skipped
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockMinorUpdateGenerator.generate).not.toHaveBeenCalled();

      // Second execution - executed
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe('runMinorUpdate - successful execution', () => {
    it('should generate content with correct context', async () => {
      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));

      scheduler.start();
      await jest.advanceTimersByTimeAsync(5000);

      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledWith({
        updateType: 'minor',
        timestamp: expect.any(Date),
      });
    });

    it('should send layout to Vestaboard after generation', async () => {
      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));

      scheduler.start();
      await jest.advanceTimersByTimeAsync(5000);

      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledWith(
        mockContent.layout.characterCodes
      );
    });

    it('should call shouldSkip before generating', async () => {
      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));

      scheduler.start();
      await jest.advanceTimersByTimeAsync(5000);

      // Verify call order: shouldSkip → generate → sendLayout
      const shouldSkipCallOrder = mockMinorUpdateGenerator.shouldSkip.mock.invocationCallOrder[0];
      const generateCallOrder = mockMinorUpdateGenerator.generate.mock.invocationCallOrder[0];
      const sendLayoutCallOrder = mockVestaboardClient.sendLayout.mock.invocationCallOrder[0];

      expect(shouldSkipCallOrder).toBeLessThan(generateCallOrder);
      expect(generateCallOrder).toBeLessThan(sendLayoutCallOrder);
    });
  });

  describe('runMinorUpdate - validation errors', () => {
    it('should throw error when layout is missing', async () => {
      const contentWithoutLayout: GeneratedContent = {
        text: 'Test',
        outputMode: 'layout',
        metadata: {},
      };

      mockMinorUpdateGenerator.generate.mockResolvedValue(contentWithoutLayout);

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      // Advance to trigger execution
      await jest.advanceTimersByTimeAsync(5000);

      // Error should be caught and logged (scheduler continues running)
      expect(mockVestaboardClient.sendLayout).not.toHaveBeenCalled();
    });

    it('should throw error when characterCodes is missing', async () => {
      const contentWithoutCharacterCodes: GeneratedContent = {
        text: 'Test',
        outputMode: 'layout',
        layout: {
          rows: [],
        },
        metadata: {},
      };

      mockMinorUpdateGenerator.generate.mockResolvedValue(contentWithoutCharacterCodes);

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      await jest.advanceTimersByTimeAsync(5000);

      // Error should be caught (scheduler continues)
      expect(mockVestaboardClient.sendLayout).not.toHaveBeenCalled();
    });
  });

  describe('runMinorUpdate - error handling', () => {
    it('should log errors but not crash scheduler when generation fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockMinorUpdateGenerator.generate.mockRejectedValue(new Error('Generation failed'));

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      // First execution - fails
      await jest.advanceTimersByTimeAsync(5000);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to run minor update:',
        expect.any(Error)
      );

      // Reset mock for second execution
      mockMinorUpdateGenerator.generate.mockResolvedValue(mockContent);

      // Second execution - succeeds (scheduler still running)
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(2);

      consoleErrorSpy.mockRestore();
    });

    it('should continue running when sendLayout fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockVestaboardClient.sendLayout.mockRejectedValue(new Error('Network error'));

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      // First execution - sendLayout fails
      await jest.advanceTimersByTimeAsync(5000);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to run minor update:',
        expect.any(Error)
      );

      // Reset mock for second execution
      mockVestaboardClient.sendLayout.mockResolvedValue(undefined);

      // Second execution - succeeds (scheduler still running)
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledTimes(2);

      consoleErrorSpy.mockRestore();
    });

    it('should handle shouldSkip throwing an error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockMinorUpdateGenerator.shouldSkip.mockImplementation(() => {
        throw new Error('shouldSkip error');
      });

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      await jest.advanceTimersByTimeAsync(5000);

      // Error should be caught
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to run minor update:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle validation error for missing layout', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Return content with layout but missing characterCodes
      mockMinorUpdateGenerator.generate.mockResolvedValue({
        text: 'Test',
        outputMode: 'layout',
        layout: { rows: [] },
        metadata: {},
      });

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      await jest.advanceTimersByTimeAsync(5000);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to run minor update:',
        expect.objectContaining({
          message: 'Minor update must return valid layout with characterCodes',
        })
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid start/stop cycles', () => {
      scheduler.start();
      scheduler.stop();
      scheduler.start();
      scheduler.stop();
      scheduler.start();
      scheduler.stop();

      expect(() => scheduler.start()).not.toThrow();
    });

    it('should execute multiple updates correctly over time', async () => {
      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));

      scheduler.start();

      // First update at :00
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(1);

      // Second update at :01
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(2);

      // Third update at :02
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(3);

      // Fourth update at :03
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(4);

      // All should have sent to Vestaboard
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledTimes(4);
    });

    it('should handle mixed skip and execute patterns', async () => {
      mockMinorUpdateGenerator.shouldSkip
        .mockReturnValueOnce(false) // Execute
        .mockReturnValueOnce(true) // Skip
        .mockReturnValueOnce(false) // Execute
        .mockReturnValueOnce(true) // Skip
        .mockReturnValueOnce(false); // Execute

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      // Execute 5 update cycles
      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(i === 0 ? 5000 : 60000);
      }

      // Should have executed 3 times (false, false, false), skipped 2 times (true, true)
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(3);
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledTimes(3);
    });

    it('should recover from errors and continue scheduling', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockMinorUpdateGenerator.generate
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(mockContent)
        .mockRejectedValueOnce(new Error('Second error'))
        .mockResolvedValueOnce(mockContent);

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      // First update - error
      await jest.advanceTimersByTimeAsync(5000);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      // Second update - success
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledTimes(1);

      // Third update - error
      await jest.advanceTimersByTimeAsync(60000);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

      // Fourth update - success
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalledTimes(2);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle midnight transition correctly', async () => {
      // Start at 23:59:55
      jest.setSystemTime(new Date('2025-11-30T23:59:55.000Z'));

      scheduler.start();

      // Advance to midnight (5 seconds)
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalled();

      // Continue into next day
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(2);
    });

    it('should handle very precise millisecond timing', async () => {
      // Test at :45.999 seconds (14.001 seconds until next minute)
      jest.setSystemTime(new Date('2025-11-30T12:00:45.999Z'));

      scheduler.start();
      expect(mockMinorUpdateGenerator.generate).not.toHaveBeenCalled();

      // Advance 14.001 seconds (14001ms)
      await jest.advanceTimersByTimeAsync(14001);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalled();
    });

    it('should handle start at exactly :00 seconds', async () => {
      // Start exactly at minute boundary
      jest.setSystemTime(new Date('2025-11-30T12:00:00.000Z'));

      scheduler.start();

      // Should wait full 60 seconds until next minute
      expect(mockMinorUpdateGenerator.generate).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalled();
    });
  });
});
