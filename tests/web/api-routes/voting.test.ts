/**
 * Integration tests for voting API routes
 * Tests POST /api/vote and GET /api/vote/stats endpoints
 *
 * @jest-environment node
 */

import { submitVote, getVoteStats } from '../../../src/web/routes/voting.js';
import { VoteRepository } from '../../../src/storage/repositories/vote-repo.js';
import type { VoteRecord } from '../../../src/storage/models/vote.js';
import type { Request, Response } from '../../../src/web/types.js';

// Mock VoteRepository
jest.mock('../../../src/storage/repositories/vote-repo.js');
jest.mock('../../../src/storage/models/vote.js');

describe('Voting API Routes', () => {
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

  describe('POST /api/vote', () => {
    it('should submit a good vote successfully', async () => {
      const mockVote: VoteRecord = {
        id: 'vote-123',
        contentId: 'content-456',
        vote: 'good',
        votedAt: new Date('2025-01-15T10:00:00Z'),
      };

      mockRequest.body = {
        contentId: 'content-456',
        vote: 'good',
      };

      const mockSubmitVote = jest.fn().mockResolvedValue(mockVote);
      const mockRepository = {
        submitVote: mockSubmitVote,
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      await submitVote(mockRequest, mockResponse, mockRepository);

      expect(mockSubmitVote).toHaveBeenCalledWith('content-456', 'good');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockVote,
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should submit a bad vote successfully', async () => {
      const mockVote: VoteRecord = {
        id: 'vote-789',
        contentId: 'content-456',
        vote: 'bad',
        votedAt: new Date('2025-01-15T10:05:00Z'),
      };

      mockRequest.body = {
        contentId: 'content-456',
        vote: 'bad',
      };

      const mockSubmitVote = jest.fn().mockResolvedValue(mockVote);
      const mockRepository = {
        submitVote: mockSubmitVote,
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      await submitVote(mockRequest, mockResponse, mockRepository);

      expect(mockSubmitVote).toHaveBeenCalledWith('content-456', 'bad');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockVote,
      });
    });

    it('should return 400 for missing contentId', async () => {
      mockRequest.body = {
        vote: 'good',
      };

      await submitVote(mockRequest, mockResponse);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'contentId and vote are required',
      });
    });

    it('should return 400 for missing vote', async () => {
      mockRequest.body = {
        contentId: 'content-456',
      };

      await submitVote(mockRequest, mockResponse);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'contentId and vote are required',
      });
    });

    it('should return 400 for invalid vote value', async () => {
      mockRequest.body = {
        contentId: 'content-456',
        vote: 'excellent',
      };

      await submitVote(mockRequest, mockResponse);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'vote must be "good" or "bad"',
      });
    });

    it('should return 400 for non-object body', async () => {
      mockRequest.body = 'invalid';

      await submitVote(mockRequest, mockResponse);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'contentId and vote are required',
      });
    });

    it('should return 500 on repository error', async () => {
      mockRequest.body = {
        contentId: 'content-456',
        vote: 'good',
      };

      const mockSubmitVote = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockRepository = {
        submitVote: mockSubmitVote,
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      await submitVote(mockRequest, mockResponse, mockRepository);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to submit vote',
      });
    });
  });

  describe('GET /api/vote/stats', () => {
    it('should return vote statistics successfully', async () => {
      const mockStats = {
        good: 42,
        bad: 8,
        ratio: 0.84,
      };

      const mockGetOverallStats = jest.fn().mockResolvedValue(mockStats);
      const mockRepository = {
        submitVote: jest.fn(),
        getVotesByContent: jest.fn(),
        getOverallStats: mockGetOverallStats,
      } as unknown as VoteRepository;

      await getVoteStats(mockRequest, mockResponse, mockRepository);

      expect(mockGetOverallStats).toHaveBeenCalledTimes(1);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return statistics with zero votes', async () => {
      const mockStats = {
        good: 0,
        bad: 0,
        ratio: 0,
      };

      const mockGetOverallStats = jest.fn().mockResolvedValue(mockStats);
      const mockRepository = {
        submitVote: jest.fn(),
        getVotesByContent: jest.fn(),
        getOverallStats: mockGetOverallStats,
      } as unknown as VoteRepository;

      await getVoteStats(mockRequest, mockResponse, mockRepository);

      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });

    it('should return 500 on repository error', async () => {
      const mockGetOverallStats = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockRepository = {
        submitVote: jest.fn(),
        getVotesByContent: jest.fn(),
        getOverallStats: mockGetOverallStats,
      } as unknown as VoteRepository;

      await getVoteStats(mockRequest, mockResponse, mockRepository);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve vote statistics',
      });
    });
  });
});
