import { Router } from 'express';
import { Request, Response, WebDependencies } from '../types.js';
import { ContentRepository } from '../../storage/repositories/content-repo.js';

/**
 * GET /api/content/latest
 * Returns the most recent content sent to Vestaboard
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param repository - ContentRepository instance (required for operation)
 */
export async function getLatestContent(
  req: Request,
  res: Response,
  repository?: ContentRepository
): Promise<void> {
  // Return 503 if repository not available (graceful degradation)
  if (!repository) {
    res.status(503).json({
      success: false,
      error: 'Content service unavailable',
    });
    return;
  }

  try {
    const content = await repository.getLatestContent();

    if (!content) {
      res.status(404).json({
        success: false,
        error: 'No content found',
      });
      return;
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error('Error retrieving latest content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve latest content',
    });
  }
}

/**
 * GET /api/content/history?limit=20
 * Returns paginated content history
 * Query params:
 *   - limit: number of records to return (default: 20, max: 100)
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param repository - ContentRepository instance (required for operation)
 */
export async function getContentHistory(
  req: Request,
  res: Response,
  repository?: ContentRepository
): Promise<void> {
  // Return 503 if repository not available (graceful degradation)
  if (!repository) {
    res.status(503).json({
      success: false,
      error: 'Content service unavailable',
    });
    return;
  }

  try {
    // Parse and validate limit parameter
    const limitParam = req.query.limit;
    let limit = 20; // Default limit

    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 100); // Enforce maximum limit
      }
    }

    const history = await repository.getContentHistory(limit);

    res.json({
      success: true,
      data: history,
      pagination: {
        limit,
        count: history.length,
      },
    });
  } catch (error) {
    console.error('Error retrieving content history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve content history',
    });
  }
}

/**
 * Create and configure content router
 *
 * @param dependencies - WebDependencies containing contentRepository
 * @returns Express router with content routes
 */
export function createContentRouter(dependencies: WebDependencies = {}): Router {
  const router = Router();
  const { contentRepository } = dependencies;

  router.get('/latest', (req, res) =>
    getLatestContent(req as Request, res as Response, contentRepository)
  );
  router.get('/history', (req, res) =>
    getContentHistory(req as Request, res as Response, contentRepository)
  );

  return router;
}
