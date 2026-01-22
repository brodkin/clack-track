import { Router } from 'express';
import { config } from '../../config/env.js';
import type { Request, Response } from '../types.js';

/**
 * GET /api/config/vestaboard
 * Returns the current Vestaboard model configuration
 *
 * @param _req - Express request object (unused)
 * @param res - Express response object
 */
export async function getVestaboardConfig(_req: Request, res: Response): Promise<void> {
  const model = config.vestaboard?.model ?? 'black';

  res.json({
    model,
  });
}

/**
 * Create and configure config router
 *
 * @returns Express router with config routes
 */
export function createConfigRouter(): Router {
  const router = Router();

  router.get('/vestaboard', (req, res) => getVestaboardConfig(req as Request, res as Response));

  return router;
}
