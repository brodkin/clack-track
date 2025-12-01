import { Router } from 'express';
import { Request, Response, WebDependencies } from '../types.js';
import { VoteRepository } from '../../storage/repositories/vote-repo.js';

/**
 * Validate vote value
 * @internal Exported for testing purposes
 */
export function isValidVote(vote: unknown): vote is 'good' | 'bad' {
  return vote === 'good' || vote === 'bad';
}

/**
 * POST /api/vote
 * Submit a vote for content quality
 * Body: { contentId: string, vote: 'good' | 'bad' }
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param repository - VoteRepository instance (required for operation)
 */
export async function submitVote(
  req: Request,
  res: Response,
  repository?: VoteRepository
): Promise<void> {
  // Return 503 if repository not available (graceful degradation)
  if (!repository) {
    res.status(503).json({
      success: false,
      error: 'Voting service unavailable',
    });
    return;
  }

  try {
    // Validate request body
    const body = req.body;

    if (!body || typeof body !== 'object') {
      res.status(400).json({
        success: false,
        error: 'contentId and vote are required',
      });
      return;
    }

    const { contentId, vote } = body as { contentId?: unknown; vote?: unknown };

    // Validate required fields
    if (!contentId || !vote) {
      res.status(400).json({
        success: false,
        error: 'contentId and vote are required',
      });
      return;
    }

    // Validate vote value
    if (!isValidVote(vote)) {
      res.status(400).json({
        success: false,
        error: 'vote must be "good" or "bad"',
      });
      return;
    }

    // Submit vote to repository
    const voteRecord = await repository.submitVote(Number(contentId), vote);

    res.json({
      success: true,
      data: voteRecord,
    });
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit vote',
    });
  }
}

/**
 * GET /api/vote/stats
 * Returns aggregated voting statistics
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param repository - VoteRepository instance (required for operation)
 */
export async function getVoteStats(
  req: Request,
  res: Response,
  repository?: VoteRepository
): Promise<void> {
  // Return 503 if repository not available (graceful degradation)
  if (!repository) {
    res.status(503).json({
      success: false,
      error: 'Voting service unavailable',
    });
    return;
  }

  try {
    const stats = await repository.getOverallStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error retrieving vote statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vote statistics',
    });
  }
}

/**
 * Create and configure voting router
 *
 * @param dependencies - WebDependencies containing voteRepository
 * @returns Express router with voting routes
 */
export function createVotingRouter(dependencies: WebDependencies = {}): Router {
  const router = Router();
  const { voteRepository } = dependencies;

  router.post('/', (req, res) => submitVote(req as Request, res as Response, voteRepository));
  router.get('/stats', (req, res) => getVoteStats(req as Request, res as Response, voteRepository));

  return router;
}
