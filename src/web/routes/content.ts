import { Router } from 'express';
import { Request, Response, WebDependencies } from '../types.js';
import { ContentRepository } from '../../storage/repositories/content-repo.js';
import { FrameDecorator } from '../../content/frame/frame-decorator.js';
import type { ContentRecord } from '../../storage/models/content.js';

/**
 * Dependencies for the getLatestContent handler
 */
export interface LatestContentDependencies {
  /** Content repository for database access */
  repository?: ContentRepository;
  /** Frame decorator for applying time/weather frame to text content */
  frameDecorator?: FrameDecorator;
}

/**
 * Response data structure with optional characterCodes
 */
interface ContentResponseData extends Omit<ContentRecord, 'metadata'> {
  /** Original metadata from content record */
  metadata?: Record<string, unknown>;
  /** 6x22 character codes grid for Vestaboard display */
  characterCodes?: number[][];
}

/**
 * GET /api/content/latest
 * Returns the most recent content sent to Vestaboard
 *
 * For outputMode='text' or null (legacy): Applies frame decoration to generate characterCodes
 * For outputMode='layout': Returns stored characterCodes from metadata
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param dependencies - LatestContentDependencies with repository and frameDecorator
 */
export async function getLatestContent(
  req: Request,
  res: Response,
  dependencies: LatestContentDependencies = {}
): Promise<void> {
  const { repository, frameDecorator } = dependencies;

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

    // Build response data with optional characterCodes
    const responseData: ContentResponseData = { ...content };

    // Apply frame decoration or extract stored characterCodes based on outputMode
    const characterCodes = await getCharacterCodes(content, frameDecorator);
    if (characterCodes) {
      responseData.characterCodes = characterCodes;
    }

    res.json({
      success: true,
      data: responseData,
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
 * Get character codes for content based on outputMode
 *
 * - For 'text' or null (legacy): Apply frame decoration to generate characterCodes
 * - For 'layout': Return stored characterCodes from metadata
 *
 * @param content - Content record from database
 * @param frameDecorator - Optional frame decorator for text content
 * @returns 6x22 character codes array, or undefined if unavailable
 */
async function getCharacterCodes(
  content: ContentRecord,
  frameDecorator?: FrameDecorator
): Promise<number[][] | undefined> {
  // For layout mode, extract characterCodes from metadata
  if (content.outputMode === 'layout') {
    const metadata = content.metadata as Record<string, unknown> | undefined;
    const storedCodes = metadata?.characterCodes;

    // Validate that characterCodes is a 2D array
    if (Array.isArray(storedCodes) && storedCodes.every(row => Array.isArray(row))) {
      return storedCodes as number[][];
    }

    // Layout mode without valid characterCodes - graceful degradation
    return undefined;
  }

  // For text mode (or null/legacy), apply frame decoration
  if (!frameDecorator) {
    // No decorator available - graceful degradation
    return undefined;
  }

  try {
    // Apply frame decoration with current timestamp
    // FrameDecorator handles weather unavailability gracefully
    const frameResult = await frameDecorator.decorate(content.text, new Date());
    return frameResult.layout;
  } catch (error) {
    // Frame decoration failed - graceful degradation
    console.warn('Frame decoration failed:', error);
    return undefined;
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
 * @param dependencies - WebDependencies containing contentRepository and frameDecorator
 * @returns Express router with content routes
 */
export function createContentRouter(dependencies: WebDependencies = {}): Router {
  const router = Router();
  const { contentRepository, frameDecorator } = dependencies;

  router.get('/latest', (req, res) =>
    getLatestContent(req as Request, res as Response, {
      repository: contentRepository,
      frameDecorator,
    })
  );
  router.get('/history', (req, res) =>
    getContentHistory(req as Request, res as Response, contentRepository)
  );

  return router;
}
