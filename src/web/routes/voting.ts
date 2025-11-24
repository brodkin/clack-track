import { Request, Response } from '../types.js';
import { VoteRepository } from '../../storage/repositories/vote-repo.js';
import { VoteModel } from '../../storage/models/vote.js';

// Singleton repository instance
let voteRepository: VoteRepository | null = null;

/**
 * Get or create VoteRepository instance
 * Uses dependency injection pattern for testability
 */
function getVoteRepository(): VoteRepository {
  if (!voteRepository) {
    const model = new VoteModel();
    voteRepository = new VoteRepository(model);
  }
  return voteRepository;
}

/**
 * Validate vote value
 */
function isValidVote(vote: unknown): vote is 'good' | 'bad' {
  return vote === 'good' || vote === 'bad';
}

/**
 * POST /api/vote
 * Submit a vote for content quality
 * Body: { contentId: string, vote: 'good' | 'bad' }
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param repository - Optional VoteRepository for testing (defaults to singleton)
 */
export async function submitVote(
  req: Request,
  res: Response,
  repository: VoteRepository = getVoteRepository()
): Promise<void> {
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
    const voteRecord = await repository.submitVote(contentId as string, vote);

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
 * @param repository - Optional VoteRepository for testing (defaults to singleton)
 */
export async function getVoteStats(
  req: Request,
  res: Response,
  repository: VoteRepository = getVoteRepository()
): Promise<void> {
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
