/**
 * Unit tests for content API routes
 * Tests GET /api/content/latest and GET /api/content/history endpoints
 */

import { getLatestContent, getContentHistory } from '../../../../src/web/routes/content.js';
import { ContentRepository } from '../../../../src/storage/repositories/content-repo.js';
import type { ContentRecord } from '../../../../src/storage/models/content.js';
import type { Request, Response } from '../../../../src/web/types.js';

// Mock ContentRepository
jest.mock('../../../../src/storage/repositories/content-repo.js');
jest.mock('../../../../src/storage/models/content.js');

describe('Content API Routes', () => {
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

  describe('GET /api/content/latest', () => {
    it('should return latest content when available', async () => {
      const mockContent: ContentRecord = {
        id: 123,
        text: 'Test content',
        type: 'major',
        generatedAt: new Date('2025-01-15T10:00:00Z'),
        sentAt: new Date('2025-01-15T10:01:00Z'),
        aiProvider: 'openai',
      };

      // Mock the repository method
      const mockGetLatestContent = jest.fn().mockResolvedValue(mockContent);
      const mockRepository = {
        getLatestContent: mockGetLatestContent,
        getContentHistory: jest.fn(),
        saveContent: jest.fn(),
      } as unknown as ContentRepository;

      await getLatestContent(mockRequest, mockResponse, mockRepository);

      expect(mockGetLatestContent).toHaveBeenCalledTimes(1);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockContent,
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return 404 when no content found', async () => {
      const mockGetLatestContent = jest.fn().mockResolvedValue(null);
      const mockRepository = {
        getLatestContent: mockGetLatestContent,
        getContentHistory: jest.fn(),
        saveContent: jest.fn(),
      } as unknown as ContentRepository;

      await getLatestContent(mockRequest, mockResponse, mockRepository);

      expect(mockGetLatestContent).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'No content found',
      });
    });

    it('should return 500 on repository error', async () => {
      const mockGetLatestContent = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockRepository = {
        getLatestContent: mockGetLatestContent,
        getContentHistory: jest.fn(),
        saveContent: jest.fn(),
      } as unknown as ContentRepository;

      await getLatestContent(mockRequest, mockResponse, mockRepository);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve latest content',
      });
    });
  });

  describe('GET /api/content/history', () => {
    it('should return content history with default limit', async () => {
      const mockHistory: ContentRecord[] = [
        {
          id: 1,
          text: 'Content 1',
          type: 'major',
          generatedAt: new Date('2025-01-15T10:00:00Z'),
          sentAt: new Date('2025-01-15T10:01:00Z'),
          aiProvider: 'openai',
        },
      ];

      const mockGetContentHistory = jest.fn().mockResolvedValue(mockHistory);
      const mockRepository = {
        getLatestContent: jest.fn(),
        getContentHistory: mockGetContentHistory,
        saveContent: jest.fn(),
      } as unknown as ContentRepository;

      await getContentHistory(mockRequest, mockResponse, mockRepository);

      expect(mockGetContentHistory).toHaveBeenCalledWith(20);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockHistory,
        pagination: {
          limit: 20,
          count: 1,
        },
      });
    });

    it('should return content history with custom limit', async () => {
      mockRequest.query = { limit: '50' };
      const mockHistory: ContentRecord[] = [];

      const mockGetContentHistory = jest.fn().mockResolvedValue(mockHistory);
      const mockRepository = {
        getLatestContent: jest.fn(),
        getContentHistory: mockGetContentHistory,
        saveContent: jest.fn(),
      } as unknown as ContentRepository;

      await getContentHistory(mockRequest, mockResponse, mockRepository);

      expect(mockGetContentHistory).toHaveBeenCalledWith(50);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockHistory,
        pagination: {
          limit: 50,
          count: 0,
        },
      });
    });

    it('should enforce maximum limit of 100', async () => {
      mockRequest.query = { limit: '500' };
      const mockHistory: ContentRecord[] = [];

      const mockGetContentHistory = jest.fn().mockResolvedValue(mockHistory);
      const mockRepository = {
        getLatestContent: jest.fn(),
        getContentHistory: mockGetContentHistory,
        saveContent: jest.fn(),
      } as unknown as ContentRepository;

      await getContentHistory(mockRequest, mockResponse, mockRepository);

      expect(mockGetContentHistory).toHaveBeenCalledWith(100);
    });

    it('should handle invalid limit parameter', async () => {
      mockRequest.query = { limit: 'invalid' };
      const mockHistory: ContentRecord[] = [];

      const mockGetContentHistory = jest.fn().mockResolvedValue(mockHistory);
      const mockRepository = {
        getLatestContent: jest.fn(),
        getContentHistory: mockGetContentHistory,
        saveContent: jest.fn(),
      } as unknown as ContentRepository;

      await getContentHistory(mockRequest, mockResponse, mockRepository);

      expect(mockGetContentHistory).toHaveBeenCalledWith(20);
    });

    it('should return 500 on repository error', async () => {
      const mockGetContentHistory = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockRepository = {
        getLatestContent: jest.fn(),
        getContentHistory: mockGetContentHistory,
        saveContent: jest.fn(),
      } as unknown as ContentRepository;

      await getContentHistory(mockRequest, mockResponse, mockRepository);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve content history',
      });
    });
  });
});
