/**
 * Unit tests for ThrottledLogger
 *
 * Tests throttling behavior to prevent error spam in production.
 * Verifies that identical error keys are suppressed within throttle window
 * and suppressed count is reported when logging resumes.
 */

import { ThrottledLogger } from '@/utils/throttled-logger';

describe('ThrottledLogger', () => {
  let logger: ThrottledLogger;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create logger with short throttle window for testing
    logger = new ThrottledLogger(100); // 100ms throttle window

    // Spy on console methods
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Mock Date.now() for time control
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('warn()', () => {
    it('should log first warning immediately', () => {
      logger.warn('test-key', 'Test warning message');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[test-key] Test warning message');
    });

    it('should suppress same key within throttle window', () => {
      // First log - should go through
      logger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Second log immediately after - should be suppressed
      jest.advanceTimersByTime(50); // 50ms < 100ms throttle window
      logger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // Still 1, not 2

      // Third log still within window - should be suppressed
      jest.advanceTimersByTime(40); // Total 90ms < 100ms
      logger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // Still 1, not 3
    });

    it('should log again after throttle window expires', () => {
      // First log
      logger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Advance time beyond throttle window
      jest.advanceTimersByTime(101); // 101ms > 100ms throttle window

      // Second log - should go through
      logger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('should show suppressed count when logging resumes', () => {
      // First log
      logger.warn('test-key', 'Test warning');

      // Suppress 3 warnings within throttle window
      jest.advanceTimersByTime(20);
      logger.warn('test-key', 'Test warning');
      jest.advanceTimersByTime(20);
      logger.warn('test-key', 'Test warning');
      jest.advanceTimersByTime(20);
      logger.warn('test-key', 'Test warning');

      // Advance beyond throttle window
      jest.advanceTimersByTime(50); // Total > 100ms

      // Next log should show suppressed count
      logger.warn('test-key', 'Test warning');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(2); // Initial + resumed
      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        '[test-key] Test warning (3 similar messages suppressed)'
      );
    });

    it('should handle different keys independently', () => {
      // Log with key1
      logger.warn('key1', 'Warning 1');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[key1] Warning 1');

      // Log with key2 (should not be suppressed even though key1 was just logged)
      logger.warn('key2', 'Warning 2');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[key2] Warning 2');

      // Log with key3
      logger.warn('key3', 'Warning 3');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[key3] Warning 3');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    });

    it('should pass through additional arguments', () => {
      const errorObj = new Error('Details');
      const metadata = { foo: 'bar' };

      logger.warn('test-key', 'Test warning', errorObj, metadata);

      expect(consoleWarnSpy).toHaveBeenCalledWith('[test-key] Test warning', errorObj, metadata);
    });

    it('should reset suppressed count after logging', () => {
      // First log
      logger.warn('test-key', 'Test warning');

      // Suppress 2 warnings
      jest.advanceTimersByTime(20);
      logger.warn('test-key', 'Test warning');
      jest.advanceTimersByTime(20);
      logger.warn('test-key', 'Test warning');

      // Advance beyond throttle window and log (shows suppressed count)
      jest.advanceTimersByTime(100);
      logger.warn('test-key', 'Test warning');

      // Suppress 1 more warning
      jest.advanceTimersByTime(20);
      logger.warn('test-key', 'Test warning');

      // Advance again and log - should show count of 1, not 3
      jest.advanceTimersByTime(100);
      logger.warn('test-key', 'Test warning');

      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        '[test-key] Test warning (1 similar messages suppressed)'
      );
    });
  });

  describe('error()', () => {
    it('should log first error immediately', () => {
      logger.error('test-key', 'Test error message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[test-key] Test error message');
    });

    it('should suppress same key within throttle window', () => {
      // First log
      logger.error('test-key', 'Test error');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      // Second log immediately after - should be suppressed
      jest.advanceTimersByTime(50);
      logger.error('test-key', 'Test error');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should show suppressed count when logging resumes', () => {
      // First log
      logger.error('test-key', 'Test error');

      // Suppress 2 errors
      jest.advanceTimersByTime(20);
      logger.error('test-key', 'Test error');
      jest.advanceTimersByTime(20);
      logger.error('test-key', 'Test error');

      // Advance beyond throttle window
      jest.advanceTimersByTime(100);

      // Next log should show suppressed count
      logger.error('test-key', 'Test error');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenLastCalledWith(
        '[test-key] Test error (2 similar messages suppressed)'
      );
    });

    it('should handle different keys independently', () => {
      logger.error('key1', 'Error 1');
      logger.error('key2', 'Error 2');
      logger.error('key3', 'Error 3');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('constructor', () => {
    it('should use default throttle window of 5 minutes', () => {
      const defaultLogger = new ThrottledLogger();

      // First log
      defaultLogger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Advance 4 minutes - should still be suppressed
      jest.advanceTimersByTime(4 * 60 * 1000);
      defaultLogger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Advance beyond 5 minutes - should log again
      jest.advanceTimersByTime(61 * 1000); // Total > 5 minutes
      defaultLogger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('should accept custom throttle window', () => {
      const customLogger = new ThrottledLogger(500); // 500ms

      // First log
      customLogger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Within 500ms - suppressed
      jest.advanceTimersByTime(400);
      customLogger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Beyond 500ms - logs again
      jest.advanceTimersByTime(150);
      customLogger.warn('test-key', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('real-world scenario: cron scheduler errors', () => {
    it('should prevent error spam from repeated failures', () => {
      // Create logger with default 5-minute throttle for realistic scenario
      const cronLogger = new ThrottledLogger(); // 5 minutes default

      // Simulate cron running every minute with same error
      const errorKey = 'minor-update-failed';

      // Minute 1 - logs
      cronLogger.error(errorKey, 'Failed to run minor update');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      // Minutes 2-5 - suppressed (within 5 minute window)
      for (let i = 0; i < 4; i++) {
        jest.advanceTimersByTime(60 * 1000); // 1 minute
        cronLogger.error(errorKey, 'Failed to run minor update');
      }
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // Still just 1

      // Minute 6 - logs with suppressed count
      jest.advanceTimersByTime(60 * 1000);
      cronLogger.error(errorKey, 'Failed to run minor update');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenLastCalledWith(
        '[minor-update-failed] Failed to run minor update (4 similar messages suppressed)'
      );
    });

    it('should log different error types independently', () => {
      // Different errors in cron scheduler should all be logged
      logger.error('no-cache', 'No cached content available');
      logger.error('network-error', 'Failed to connect to Vestaboard');
      logger.error('validation-error', 'Invalid layout structure');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, '[no-cache] No cached content available');
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        2,
        '[network-error] Failed to connect to Vestaboard'
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        3,
        '[validation-error] Invalid layout structure'
      );
    });
  });

  describe('memory cleanup', () => {
    it('should never exceed max entries of 100', () => {
      // Create a custom logger to access internal state
      const testLogger = new ThrottledLogger(100);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Add 150 unique keys
      for (let i = 0; i < 150; i++) {
        testLogger.warn(`key-${i}`, `Message ${i}`);
      }

      // Verify all were logged
      expect(warnSpy).toHaveBeenCalledTimes(150);

      // The internal maps should never exceed 100 entries
      // We can't directly access private fields, but we can verify behavior:
      // Try to suppress messages for the last 100 keys added (50-149)
      // These should still be in the map
      jest.advanceTimersByTime(50); // Within throttle window

      // These keys (50-149) should be in the map and get suppressed
      for (let i = 50; i < 150; i++) {
        testLogger.warn(`key-${i}`, `Message ${i} suppressed`);
      }

      // Should still be 150 (no new logs, all suppressed)
      expect(warnSpy).toHaveBeenCalledTimes(150);

      // Advance beyond throttle window
      jest.advanceTimersByTime(100);

      // Log one of the retained keys - should show suppressed count
      testLogger.warn('key-149', 'Message 149 final');
      const key149Calls = warnSpy.mock.calls.filter(call => call[0].includes('[key-149]'));
      const lastKey149Call = key149Calls[key149Calls.length - 1][0];
      expect(lastKey149Call).toContain('1 similar messages suppressed');

      warnSpy.mockRestore();
    });

    it('should evict oldest entries when limit reached', () => {
      // Add exactly 100 entries
      for (let i = 0; i < 100; i++) {
        logger.error(`key-${i}`, `Message ${i}`);
      }

      // Suppress one message for key-0 (oldest)
      jest.advanceTimersByTime(50);
      logger.error('key-0', 'Message 0 suppressed');

      // Add one more entry (should evict key-0)
      logger.error('key-100', 'Message 100');

      // Advance beyond throttle window
      jest.advanceTimersByTime(100);

      // key-0 should have been evicted, so no suppressed count
      logger.error('key-0', 'Message 0 after eviction');
      const key0Calls = consoleErrorSpy.mock.calls.filter(call => call[0].includes('[key-0]'));
      const lastKey0Call = key0Calls[key0Calls.length - 1][0];
      expect(lastKey0Call).not.toContain('similar messages suppressed');
    });

    it('should maintain functionality after eviction', () => {
      // Fill to capacity
      for (let i = 0; i < 100; i++) {
        logger.warn(`key-${i}`, `Message ${i}`);
      }

      // Trigger evictions by adding more
      for (let i = 100; i < 110; i++) {
        logger.warn(`key-${i}`, `Message ${i}`);
      }

      // Suppress and log for a retained key
      const retainedKey = 'key-105'; // Should still be in map
      jest.advanceTimersByTime(50);
      logger.warn(retainedKey, 'Suppressed');
      logger.warn(retainedKey, 'Suppressed again');

      jest.advanceTimersByTime(100);
      logger.warn(retainedKey, 'After throttle');

      // Should show suppressed count
      const calls = consoleWarnSpy.mock.calls.filter(call => call[0].includes(`[${retainedKey}]`));
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toContain('2 similar messages suppressed');
    });
  });
});
