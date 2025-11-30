/**
 * Tests for test-board CLI command
 *
 * Tests the Vestaboard connection testing functionality.
 */

// Set environment variables BEFORE any imports that call bootstrap
process.env.OPENAI_API_KEY = 'test-key';
process.env.VESTABOARD_LOCAL_API_KEY = 'test-vestaboard-key';
process.env.VESTABOARD_LOCAL_API_URL = 'http://localhost:7000';

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock bootstrap module BEFORE importing the command
jest.mock('../../../../src/bootstrap.js');

import { testBoardCommand } from '../../../../src/cli/commands/test-board.js';
import * as loggerModule from '../../../../src/utils/logger.js';

describe('test-board command', () => {
  let processExitSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock logger functions
    logSpy = jest.spyOn(loggerModule, 'log').mockImplementation();
    errorSpy = jest.spyOn(loggerModule, 'error').mockImplementation();

    // Mock console methods (in case they are used directly)
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Mock process.exit to prevent test termination
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('not implemented behavior', () => {
    it('should log initial connection message', async () => {
      // Act
      await testBoardCommand();

      // Assert - Check log was called with connection message
      expect(logSpy).toHaveBeenCalledWith('Testing Vestaboard connection...');
    });

    it('should throw "Not implemented" error', async () => {
      // Act
      await testBoardCommand();

      // Assert - Check error logger was called with correct messages
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to test Vestaboard connection:',
        expect.any(Error)
      );

      // Verify the error is "Not implemented"
      const errorCall = errorSpy.mock.calls[0];
      const thrownError = errorCall[1] as Error;
      expect(thrownError.message).toBe('Not implemented');
    });

    it('should exit with code 1 on error', async () => {
      // Act
      await testBoardCommand();

      // Assert
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle error in try-catch block', async () => {
      // This test verifies the error handling flow
      // Act
      await testBoardCommand();

      // Assert - Verify the sequence: log → error → exit (using invocationCallOrder)
      const logCallOrder = logSpy.mock.invocationCallOrder[0];
      const errorCallOrder = errorSpy.mock.invocationCallOrder[0];
      const exitCallOrder = processExitSpy.mock.invocationCallOrder[0];

      expect(logCallOrder).toBeLessThan(errorCallOrder);
      expect(errorCallOrder).toBeLessThan(exitCallOrder);
    });
  });

  describe('error handling', () => {
    it('should catch any thrown error and log it', async () => {
      // Act
      await testBoardCommand();

      // Assert - Verify error method was called
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to test Vestaboard connection'),
        expect.any(Error)
      );
    });

    it('should exit process after error', async () => {
      // Act
      await testBoardCommand();

      // Assert
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(processExitSpy).toHaveBeenCalledTimes(1);
    });

    it('should log error message before exiting', async () => {
      // Act
      await testBoardCommand();

      // Assert - Verify error was logged before exit
      const errorCallOrder = errorSpy.mock.invocationCallOrder[0];
      const exitCallOrder = processExitSpy.mock.invocationCallOrder[0];
      expect(errorCallOrder).toBeLessThan(exitCallOrder);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple calls independently', async () => {
      // Act - Call command twice
      await testBoardCommand();
      jest.clearAllMocks(); // Clear between calls
      await testBoardCommand();

      // Assert - Second call should have same behavior
      expect(logSpy).toHaveBeenCalledWith('Testing Vestaboard connection...');
      expect(errorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should not modify environment or state', async () => {
      // Arrange - Capture initial state
      const initialEnv = { ...process.env };

      // Act
      await testBoardCommand();

      // Assert - Environment unchanged
      expect(process.env).toEqual(initialEnv);
    });
  });
});
