/**
 * Unit tests for voting API routes
 * Tests POST /api/vote and GET /api/vote/stats endpoints
 */

import {
  submitVote,
  getVoteStats,
  createVotingRouter,
  isValidVote,
} from '../../../../src/web/routes/voting.js';
import { VoteRepository } from '../../../../src/storage/repositories/vote-repo.js';
import type { VoteRecord } from '../../../../src/storage/models/vote.js';
import type { Request, Response } from '../../../../src/web/types.js';

// Mock VoteRepository
jest.mock('../../../../src/storage/repositories/vote-repo.js');
jest.mock('../../../../src/storage/models/vote.js');

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

  describe('isValidVote', () => {
    it('should return true for "good" vote', () => {
      expect(isValidVote('good')).toBe(true);
    });

    it('should return true for "bad" vote', () => {
      expect(isValidVote('bad')).toBe(true);
    });

    it('should return false for invalid string', () => {
      expect(isValidVote('excellent')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isValidVote(123)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidVote(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidVote(undefined)).toBe(false);
    });

    it('should return false for object', () => {
      expect(isValidVote({ vote: 'good' })).toBe(false);
    });
  });

  describe('POST /api/vote', () => {
    it('should submit a good vote successfully', async () => {
      const mockVote: VoteRecord = {
        id: 123,
        content_id: 456,
        vote_type: 'good',
        created_at: new Date('2025-01-15T10:00:00Z'),
      };

      mockRequest.body = {
        contentId: '456',
        vote: 'good',
      };

      const mockSubmitVote = jest.fn().mockResolvedValue(mockVote);
      const mockRepository = {
        submitVote: mockSubmitVote,
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      await submitVote(mockRequest, mockResponse, mockRepository);

      expect(mockSubmitVote).toHaveBeenCalledWith(456, 'good');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockVote,
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should submit a bad vote successfully', async () => {
      const mockVote: VoteRecord = {
        id: 789,
        content_id: 456,
        vote_type: 'bad',
        created_at: new Date('2025-01-15T10:05:00Z'),
      };

      mockRequest.body = {
        contentId: '456',
        vote: 'bad',
      };

      const mockSubmitVote = jest.fn().mockResolvedValue(mockVote);
      const mockRepository = {
        submitVote: mockSubmitVote,
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      await submitVote(mockRequest, mockResponse, mockRepository);

      expect(mockSubmitVote).toHaveBeenCalledWith(456, 'bad');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockVote,
      });
    });

    it('should return 400 for missing contentId', async () => {
      mockRequest.body = {
        vote: 'good',
      };

      const mockRepository = {
        submitVote: jest.fn(),
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      await submitVote(mockRequest, mockResponse, mockRepository);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'contentId and vote are required',
      });
    });

    it('should return 400 for missing vote', async () => {
      mockRequest.body = {
        contentId: '456',
      };

      const mockRepository = {
        submitVote: jest.fn(),
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      await submitVote(mockRequest, mockResponse, mockRepository);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'contentId and vote are required',
      });
    });

    it('should return 400 for invalid vote value (string)', async () => {
      mockRequest.body = {
        contentId: '456',
        vote: 'excellent',
      };

      const mockRepository = {
        submitVote: jest.fn(),
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      await submitVote(mockRequest, mockResponse, mockRepository);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'vote must be "good" or "bad"',
      });
    });

    it('should return 400 for invalid vote value (number)', async () => {
      mockRequest.body = {
        contentId: '456',
        vote: 123,
      };

      const mockRepository = {
        submitVote: jest.fn(),
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      await submitVote(mockRequest, mockResponse, mockRepository);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'vote must be "good" or "bad"',
      });
    });

    it('should return 400 for non-object body', async () => {
      mockRequest.body = 'invalid';

      const mockRepository = {
        submitVote: jest.fn(),
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      await submitVote(mockRequest, mockResponse, mockRepository);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'contentId and vote are required',
      });
    });

    it('should return 500 on repository error', async () => {
      mockRequest.body = {
        contentId: '456',
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

    it('should return 503 when repository is not available', async () => {
      mockRequest.body = {
        contentId: '456',
        vote: 'good',
      };

      await submitVote(mockRequest, mockResponse, undefined);

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Voting service unavailable',
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

    it('should return 503 when repository is not available', async () => {
      await getVoteStats(mockRequest, mockResponse, undefined);

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Voting service unavailable',
      });
    });
  });

  describe('createVotingRouter', () => {
    it('should create router with injected repository', () => {
      const mockRepository = {
        submitVote: jest.fn(),
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      const router = createVotingRouter({ voteRepository: mockRepository });

      expect(router).toBeDefined();
      expect(typeof router).toBe('function'); // Express Router is a function
    });

    it('should create router without repository (graceful degradation)', () => {
      const router = createVotingRouter({});

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('should create router with no dependencies argument', () => {
      const router = createVotingRouter();

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('should wire POST / route to submitVote handler', async () => {
      const mockVote: VoteRecord = {
        id: 999,
        content_id: 777,
        vote_type: 'good',
        created_at: new Date('2025-01-15T12:00:00Z'),
      };

      const mockSubmitVote = jest.fn().mockResolvedValue(mockVote);
      const mockRepository = {
        submitVote: mockSubmitVote,
        getVotesByContent: jest.fn(),
        getOverallStats: jest.fn(),
      } as unknown as VoteRepository;

      const router = createVotingRouter({ voteRepository: mockRepository });

      // Simulate Express route execution
      const req = {
        body: { contentId: '777', vote: 'good' },
        params: {},
        query: {},
      } as Request;

      const res = {
        json: jsonSpy,
        status: statusSpy,
        send: jest.fn(),
      } as Response;

      // Get the POST handler from the router stack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routerStack = (router as any).stack as Array<{
        route?: {
          path: string;
          methods?: { post?: boolean };
          stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
        };
      }>;
      const postHandler = routerStack.find(
        layer => layer.route?.path === '/' && layer.route?.methods?.post
      );

      if (postHandler?.route?.stack[0]) {
        await postHandler.route.stack[0].handle(req, res);
      }

      expect(mockSubmitVote).toHaveBeenCalledWith(777, 'good');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockVote,
      });
    });

    it('should wire GET /stats route to getVoteStats handler', async () => {
      const mockStats = {
        good: 10,
        bad: 2,
        ratio: 0.83,
      };

      const mockGetOverallStats = jest.fn().mockResolvedValue(mockStats);
      const mockRepository = {
        submitVote: jest.fn(),
        getVotesByContent: jest.fn(),
        getOverallStats: mockGetOverallStats,
      } as unknown as VoteRepository;

      const router = createVotingRouter({ voteRepository: mockRepository });

      // Simulate Express route execution
      const req = {
        body: undefined,
        params: {},
        query: {},
      } as Request;

      const res = {
        json: jsonSpy,
        status: statusSpy,
        send: jest.fn(),
      } as Response;

      // Get the GET handler from the router stack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routerStack = (router as any).stack as Array<{
        route?: {
          path: string;
          methods?: { get?: boolean };
          stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
        };
      }>;
      const getHandler = routerStack.find(
        layer => layer.route?.path === '/stats' && layer.route?.methods?.get
      );

      if (getHandler?.route?.stack[0]) {
        await getHandler.route.stack[0].handle(req, res);
      }

      expect(mockGetOverallStats).toHaveBeenCalledTimes(1);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });
  });
});
