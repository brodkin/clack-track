import { Request, Response } from '../types.js';

export async function getLatestContent(req: Request, res: Response): Promise<void> {
  // TODO: Implement endpoint to get latest content
  // GET /api/content/latest
  // Returns the most recent content sent to Vestaboard
  res.json({
    success: false,
    error: 'Not implemented',
  });
}

export async function getContentHistory(req: Request, res: Response): Promise<void> {
  // TODO: Implement endpoint to get content history
  // GET /api/content/history?limit=20
  // Returns paginated content history
  res.json({
    success: false,
    error: 'Not implemented',
  });
}
