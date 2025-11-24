/**
 * Integration tests for logs API routes
 * Tests GET /api/logs and DELETE /api/logs endpoints
 *
 * @jest-environment node
 */

import { getDebugLogs, clearLogs } from '../../../src/web/routes/logs.js';
import { LogModel } from '../../../src/storage/models/log.js';
import type { LogRecord } from '../../../src/storage/models/log.js';
import type { Request, Response } from '../../../src/web/types.js';

// Mock LogModel
jest.mock('../../../src/storage/models/log.js');

describe('Logs API Routes', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock response with chainable status
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
      send: jest.fn(),
    };

    // Create mock request
    mockRequest = {
      params: {},
      query: {},
      body: undefined,
    };
  });

  describe('GET /api/logs', () => {
    it('should return recent logs with default limit', async () => {
      const mockLogs: LogRecord[] = [
        {
          id: 'log-1',
          level: 'info',
          message: 'Content generated successfully',
          timestamp: new Date('2025-01-15T10:00:00Z'),
        },
        {
          id: 'log-2',
          level: 'error',
          message: 'Failed to connect to API',
          timestamp: new Date('2025-01-15T09:55:00Z'),
          metadata: { error: 'ECONNREFUSED' },
        },
      ];

      const mockFindRecent = jest.fn().mockResolvedValue(mockLogs);
      const mockModel = {
        findRecent: mockFindRecent,
        deleteOlderThan: jest.fn(),
        create: jest.fn(),
      } as unknown as LogModel;

      await getDebugLogs(mockRequest, mockResponse, mockModel);

      expect(mockFindRecent).toHaveBeenCalledWith(100, undefined);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
        count: 2,
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return logs filtered by level', async () => {
      mockRequest.query = { level: 'error' };
      const mockLogs: LogRecord[] = [
        {
          id: 'log-1',
          level: 'error',
          message: 'API connection failed',
          timestamp: new Date('2025-01-15T10:00:00Z'),
        },
      ];

      const mockFindRecent = jest.fn().mockResolvedValue(mockLogs);
      const mockModel = {
        findRecent: mockFindRecent,
        deleteOlderThan: jest.fn(),
        create: jest.fn(),
      } as unknown as LogModel;

      await getDebugLogs(mockRequest, mockResponse, mockModel);

      expect(mockFindRecent).toHaveBeenCalledWith(100, 'error');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
        count: 1,
      });
    });

    it('should return logs with custom limit', async () => {
      mockRequest.query = { limit: '50' };
      const mockLogs: LogRecord[] = [];

      const mockFindRecent = jest.fn().mockResolvedValue(mockLogs);
      const mockModel = {
        findRecent: mockFindRecent,
        deleteOlderThan: jest.fn(),
        create: jest.fn(),
      } as unknown as LogModel;

      await getDebugLogs(mockRequest, mockResponse, mockModel);

      expect(mockFindRecent).toHaveBeenCalledWith(50, undefined);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
        count: 0,
      });
    });

    it('should enforce maximum limit of 500', async () => {
      mockRequest.query = { limit: '1000' };
      const mockLogs: LogRecord[] = [];

      const mockFindRecent = jest.fn().mockResolvedValue(mockLogs);
      const mockModel = {
        findRecent: mockFindRecent,
        deleteOlderThan: jest.fn(),
        create: jest.fn(),
      } as unknown as LogModel;

      await getDebugLogs(mockRequest, mockResponse, mockModel);

      expect(mockFindRecent).toHaveBeenCalledWith(500, undefined);
    });

    it('should use default limit for invalid limit param', async () => {
      mockRequest.query = { limit: 'invalid' };
      const mockLogs: LogRecord[] = [];

      const mockFindRecent = jest.fn().mockResolvedValue(mockLogs);
      const mockModel = {
        findRecent: mockFindRecent,
        deleteOlderThan: jest.fn(),
        create: jest.fn(),
      } as unknown as LogModel;

      await getDebugLogs(mockRequest, mockResponse, mockModel);

      expect(mockFindRecent).toHaveBeenCalledWith(100, undefined);
    });

    it('should ignore invalid log level filter', async () => {
      mockRequest.query = { level: 'invalid' };
      const mockLogs: LogRecord[] = [];

      const mockFindRecent = jest.fn().mockResolvedValue(mockLogs);
      const mockModel = {
        findRecent: mockFindRecent,
        deleteOlderThan: jest.fn(),
        create: jest.fn(),
      } as unknown as LogModel;

      await getDebugLogs(mockRequest, mockResponse, mockModel);

      expect(mockFindRecent).toHaveBeenCalledWith(100, undefined);
    });

    it('should return logs with both level and limit filters', async () => {
      mockRequest.query = { level: 'warn', limit: '25' };
      const mockLogs: LogRecord[] = [
        {
          id: 'log-1',
          level: 'warn',
          message: 'Rate limit approaching',
          timestamp: new Date('2025-01-15T10:00:00Z'),
        },
      ];

      const mockFindRecent = jest.fn().mockResolvedValue(mockLogs);
      const mockModel = {
        findRecent: mockFindRecent,
        deleteOlderThan: jest.fn(),
        create: jest.fn(),
      } as unknown as LogModel;

      await getDebugLogs(mockRequest, mockResponse, mockModel);

      expect(mockFindRecent).toHaveBeenCalledWith(25, 'warn');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
        count: 1,
      });
    });

    it('should return 500 on model error', async () => {
      const mockFindRecent = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockModel = {
        findRecent: mockFindRecent,
        deleteOlderThan: jest.fn(),
        create: jest.fn(),
      } as unknown as LogModel;

      await getDebugLogs(mockRequest, mockResponse, mockModel);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve debug logs',
      });
    });
  });

  describe('DELETE /api/logs', () => {
    it('should clear old logs successfully', async () => {
      const mockDeleteOlderThan = jest.fn().mockResolvedValue(15);
      const mockModel = {
        findRecent: jest.fn(),
        deleteOlderThan: mockDeleteOlderThan,
        create: jest.fn(),
      } as unknown as LogModel;

      await clearLogs(mockRequest, mockResponse, mockModel);

      expect(mockDeleteOlderThan).toHaveBeenCalledWith(30);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Logs cleared successfully',
        deletedCount: 15,
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should handle clearing with custom days parameter', async () => {
      mockRequest.query = { days: '7' };
      const mockDeleteOlderThan = jest.fn().mockResolvedValue(42);
      const mockModel = {
        findRecent: jest.fn(),
        deleteOlderThan: mockDeleteOlderThan,
        create: jest.fn(),
      } as unknown as LogModel;

      await clearLogs(mockRequest, mockResponse, mockModel);

      expect(mockDeleteOlderThan).toHaveBeenCalledWith(7);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Logs cleared successfully',
        deletedCount: 42,
      });
    });

    it('should use default days for invalid parameter', async () => {
      mockRequest.query = { days: 'invalid' };
      const mockDeleteOlderThan = jest.fn().mockResolvedValue(0);
      const mockModel = {
        findRecent: jest.fn(),
        deleteOlderThan: mockDeleteOlderThan,
        create: jest.fn(),
      } as unknown as LogModel;

      await clearLogs(mockRequest, mockResponse, mockModel);

      expect(mockDeleteOlderThan).toHaveBeenCalledWith(30);
    });

    it('should handle case where no logs are deleted', async () => {
      const mockDeleteOlderThan = jest.fn().mockResolvedValue(0);
      const mockModel = {
        findRecent: jest.fn(),
        deleteOlderThan: mockDeleteOlderThan,
        create: jest.fn(),
      } as unknown as LogModel;

      await clearLogs(mockRequest, mockResponse, mockModel);

      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Logs cleared successfully',
        deletedCount: 0,
      });
    });

    it('should return 500 on model error', async () => {
      const mockDeleteOlderThan = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockModel = {
        findRecent: jest.fn(),
        deleteOlderThan: mockDeleteOlderThan,
        create: jest.fn(),
      } as unknown as LogModel;

      await clearLogs(mockRequest, mockResponse, mockModel);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to clear logs',
      });
    });
  });
});
