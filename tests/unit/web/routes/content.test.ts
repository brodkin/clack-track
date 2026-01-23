/**
 * Unit tests for content API routes
 * Tests GET /api/content/latest and GET /api/content/history endpoints
 */

import { getLatestContent, getContentHistory } from '../../../../src/web/routes/content.js';
import { ContentRepository } from '../../../../src/storage/repositories/content-repo.js';
import { FrameDecorator } from '../../../../src/content/frame/frame-decorator.js';
import type { ContentRecord } from '../../../../src/storage/models/content.js';
import type { Request, Response } from '../../../../src/web/types.js';

// Mock ContentRepository
jest.mock('../../../../src/storage/repositories/content-repo.js');
jest.mock('../../../../src/storage/models/content.js');
jest.mock('../../../../src/content/frame/frame-decorator.js');

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
    it('should return 503 when repository is undefined', async () => {
      await getLatestContent(mockRequest, mockResponse, { repository: undefined });

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Content service unavailable',
      });
    });

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

      await getLatestContent(mockRequest, mockResponse, { repository: mockRepository });

      expect(mockGetLatestContent).toHaveBeenCalledTimes(1);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 123,
            text: 'Test content',
          }),
        })
      );
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return 404 when no content found', async () => {
      const mockGetLatestContent = jest.fn().mockResolvedValue(null);
      const mockRepository = {
        getLatestContent: mockGetLatestContent,
        getContentHistory: jest.fn(),
        saveContent: jest.fn(),
      } as unknown as ContentRepository;

      await getLatestContent(mockRequest, mockResponse, { repository: mockRepository });

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

      await getLatestContent(mockRequest, mockResponse, { repository: mockRepository });

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve latest content',
      });
    });

    describe('Frame decoration for characterCodes', () => {
      // Sample 6x22 character codes grid (filled with zeros for simplicity)
      const createMockCharacterCodes = (): number[][] => {
        return Array(6)
          .fill(null)
          .map(() => Array(22).fill(0));
      };

      it('should apply frame decoration for outputMode=text and return characterCodes', async () => {
        const mockContent: ContentRecord = {
          id: 123,
          text: 'HELLO WORLD',
          type: 'major',
          generatedAt: new Date('2025-01-15T10:00:00Z'),
          sentAt: new Date('2025-01-15T10:01:00Z'),
          aiProvider: 'openai',
          outputMode: 'text',
        };

        const mockCharacterCodes = createMockCharacterCodes();
        // Set some values to verify it's the mocked result
        mockCharacterCodes[0][0] = 8; // H
        mockCharacterCodes[0][1] = 5; // E

        const mockRepository = {
          getLatestContent: jest.fn().mockResolvedValue(mockContent),
        } as unknown as ContentRepository;

        const mockDecorator = {
          decorate: jest.fn().mockResolvedValue({
            layout: mockCharacterCodes,
            warnings: [],
          }),
        } as unknown as FrameDecorator;

        await getLatestContent(mockRequest, mockResponse, {
          repository: mockRepository,
          frameDecorator: mockDecorator,
        });

        expect(mockDecorator.decorate).toHaveBeenCalledWith('HELLO WORLD', expect.any(Date));
        expect(jsonSpy).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            id: 123,
            text: 'HELLO WORLD',
            characterCodes: mockCharacterCodes,
          }),
        });
      });

      it('should apply frame decoration for null outputMode (legacy) and return characterCodes', async () => {
        const mockContent: ContentRecord = {
          id: 456,
          text: 'LEGACY CONTENT',
          type: 'major',
          generatedAt: new Date('2025-01-15T10:00:00Z'),
          sentAt: new Date('2025-01-15T10:01:00Z'),
          aiProvider: 'openai',
          outputMode: null, // Legacy record
        };

        const mockCharacterCodes = createMockCharacterCodes();

        const mockRepository = {
          getLatestContent: jest.fn().mockResolvedValue(mockContent),
        } as unknown as ContentRepository;

        const mockDecorator = {
          decorate: jest.fn().mockResolvedValue({
            layout: mockCharacterCodes,
            warnings: [],
          }),
        } as unknown as FrameDecorator;

        await getLatestContent(mockRequest, mockResponse, {
          repository: mockRepository,
          frameDecorator: mockDecorator,
        });

        // Null outputMode should be treated as 'text'
        expect(mockDecorator.decorate).toHaveBeenCalledWith('LEGACY CONTENT', expect.any(Date));
        expect(jsonSpy).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            id: 456,
            text: 'LEGACY CONTENT',
            characterCodes: mockCharacterCodes,
          }),
        });
      });

      it('should return stored characterCodes unchanged for outputMode=layout', async () => {
        const storedCharacterCodes = createMockCharacterCodes();
        // Set distinctive values to verify they're returned as-is
        storedCharacterCodes[2][5] = 63; // Red color tile
        storedCharacterCodes[3][10] = 69; // White color tile

        const mockContent: ContentRecord = {
          id: 789,
          text: '', // Layout mode typically has empty text
          type: 'major',
          generatedAt: new Date('2025-01-15T10:00:00Z'),
          sentAt: new Date('2025-01-15T10:01:00Z'),
          aiProvider: 'programmatic',
          outputMode: 'layout',
          metadata: {
            characterCodes: storedCharacterCodes,
          },
        };

        const mockRepository = {
          getLatestContent: jest.fn().mockResolvedValue(mockContent),
        } as unknown as ContentRepository;

        const mockDecorator = {
          decorate: jest.fn(),
        } as unknown as FrameDecorator;

        await getLatestContent(mockRequest, mockResponse, {
          repository: mockRepository,
          frameDecorator: mockDecorator,
        });

        // Frame decorator should NOT be called for layout mode
        expect(mockDecorator.decorate).not.toHaveBeenCalled();

        expect(jsonSpy).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            id: 789,
            outputMode: 'layout',
            characterCodes: storedCharacterCodes,
          }),
        });
      });

      it('should return frame with time only when weather is unavailable', async () => {
        const mockContent: ContentRecord = {
          id: 111,
          text: 'NO WEATHER',
          type: 'major',
          generatedAt: new Date('2025-01-15T10:00:00Z'),
          sentAt: new Date('2025-01-15T10:01:00Z'),
          aiProvider: 'openai',
          outputMode: 'text',
        };

        const mockCharacterCodes = createMockCharacterCodes();
        const warningsFromDecorator = ['Weather data unavailable, showing time only'];

        const mockRepository = {
          getLatestContent: jest.fn().mockResolvedValue(mockContent),
        } as unknown as ContentRepository;

        // Frame decorator handles weather unavailability gracefully
        const mockDecorator = {
          decorate: jest.fn().mockResolvedValue({
            layout: mockCharacterCodes,
            warnings: warningsFromDecorator,
          }),
        } as unknown as FrameDecorator;

        await getLatestContent(mockRequest, mockResponse, {
          repository: mockRepository,
          frameDecorator: mockDecorator,
        });

        expect(mockDecorator.decorate).toHaveBeenCalled();
        expect(jsonSpy).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            id: 111,
            characterCodes: mockCharacterCodes,
          }),
        });
      });

      it('should return content without characterCodes when frameDecorator is unavailable', async () => {
        const mockContent: ContentRecord = {
          id: 222,
          text: 'NO DECORATOR',
          type: 'major',
          generatedAt: new Date('2025-01-15T10:00:00Z'),
          sentAt: new Date('2025-01-15T10:01:00Z'),
          aiProvider: 'openai',
          outputMode: 'text',
        };

        const mockRepository = {
          getLatestContent: jest.fn().mockResolvedValue(mockContent),
        } as unknown as ContentRepository;

        // No frame decorator provided - graceful degradation
        await getLatestContent(mockRequest, mockResponse, {
          repository: mockRepository,
          frameDecorator: undefined,
        });

        // Should still return content, just without characterCodes
        expect(jsonSpy).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            id: 222,
            text: 'NO DECORATOR',
          }),
        });

        // Verify characterCodes is NOT in the response when decorator unavailable
        const responseData = jsonSpy.mock.calls[0][0].data;
        expect(responseData.characterCodes).toBeUndefined();
      });

      it('should handle frame decoration errors gracefully', async () => {
        const mockContent: ContentRecord = {
          id: 333,
          text: 'DECORATOR ERROR',
          type: 'major',
          generatedAt: new Date('2025-01-15T10:00:00Z'),
          sentAt: new Date('2025-01-15T10:01:00Z'),
          aiProvider: 'openai',
          outputMode: 'text',
        };

        const mockRepository = {
          getLatestContent: jest.fn().mockResolvedValue(mockContent),
        } as unknown as ContentRepository;

        // Frame decorator throws error
        const mockDecorator = {
          decorate: jest.fn().mockRejectedValue(new Error('Decoration failed')),
        } as unknown as FrameDecorator;

        await getLatestContent(mockRequest, mockResponse, {
          repository: mockRepository,
          frameDecorator: mockDecorator,
        });

        // Should still return content, just without characterCodes
        expect(jsonSpy).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            id: 333,
            text: 'DECORATOR ERROR',
          }),
        });
      });

      it('should handle missing characterCodes in layout mode metadata gracefully', async () => {
        const mockContent: ContentRecord = {
          id: 444,
          text: '',
          type: 'major',
          generatedAt: new Date('2025-01-15T10:00:00Z'),
          sentAt: new Date('2025-01-15T10:01:00Z'),
          aiProvider: 'programmatic',
          outputMode: 'layout',
          metadata: {
            // No characterCodes in metadata
            generator: 'some-generator',
          },
        };

        const mockRepository = {
          getLatestContent: jest.fn().mockResolvedValue(mockContent),
        } as unknown as ContentRepository;

        const mockDecorator = {
          decorate: jest.fn(),
        } as unknown as FrameDecorator;

        await getLatestContent(mockRequest, mockResponse, {
          repository: mockRepository,
          frameDecorator: mockDecorator,
        });

        // Should return content without characterCodes (graceful degradation)
        expect(jsonSpy).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            id: 444,
            outputMode: 'layout',
          }),
        });

        const responseData = jsonSpy.mock.calls[0][0].data;
        expect(responseData.characterCodes).toBeUndefined();
      });
    });
  });

  describe('GET /api/content/history', () => {
    it('should return 503 when repository is undefined', async () => {
      await getContentHistory(mockRequest, mockResponse, undefined);

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Content service unavailable',
      });
    });

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
