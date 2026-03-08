import { Router } from 'express';
import { Request, Response, WebDependencies } from '../types.js';
import { VoteRepository } from '../../storage/repositories/vote-repo.js';

/**
 * Valid reason values for downvotes.
 * @internal Exported for testing purposes
 */
export const VALID_VOTE_REASONS = [
  'not_funny',
  'doesnt_make_sense',
  'factually_wrong',
  'too_negative',
  'boring',
  'badly_formatted',
  'almost_there',
  'other',
] as const;

export type VoteReason = (typeof VALID_VOTE_REASONS)[number];

/**
 * Validate vote value
 * @internal Exported for testing purposes
 */
export function isValidVote(vote: unknown): vote is 'good' | 'bad' {
  return vote === 'good' || vote === 'bad';
}

/**
 * Validate an optional reason field.
 * Returns null if reason is valid or absent, or an error string if invalid.
 * @internal Exported for testing purposes
 */
export function validateReason(reason: unknown): string | null {
  // No reason provided -- valid (optional field)
  if (reason === undefined || reason === null) {
    return null;
  }

  // Must be a non-empty string
  if (typeof reason !== 'string' || reason.length === 0) {
    return `reason must be one of: ${VALID_VOTE_REASONS.join(', ')}`;
  }

  // Must be one of the predefined values
  if (!VALID_VOTE_REASONS.includes(reason as VoteReason)) {
    return `reason must be one of: ${VALID_VOTE_REASONS.join(', ')}`;
  }

  return null;
}

/**
 * POST /api/vote
 * Submit a vote for content quality
 * Body: { contentId: string, vote: 'good' | 'bad', reason?: VoteReason }
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

    const { contentId, vote, reason } = body as {
      contentId?: unknown;
      vote?: unknown;
      reason?: unknown;
    };

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

    // Validate optional reason field
    const reasonError = validateReason(reason);
    if (reasonError) {
      res.status(400).json({
        success: false,
        error: reasonError,
      });
      return;
    }

    // Build metadata with reason if provided
    const metadata: Record<string, string> | undefined =
      typeof reason === 'string' ? { reason } : undefined;

    // Submit vote to repository
    const voteRecord = await repository.submitVote(Number(contentId), vote, metadata);

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
