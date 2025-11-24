import { Request, Response } from '../types.js';
import { LogModel, LogLevel } from '../../storage/models/log.js';

// Singleton model instance
let logModel: LogModel | null = null;

/**
 * Get or create LogModel instance
 */
function getLogModel(): LogModel {
  if (!logModel) {
    logModel = new LogModel();
  }
  return logModel;
}

/**
 * Validate log level
 */
function isValidLogLevel(level: unknown): level is LogLevel {
  return level === 'info' || level === 'warn' || level === 'error' || level === 'debug';
}

/**
 * GET /api/logs?level=info&limit=100
 * Returns recent debug logs with optional filtering
 * Query params:
 *   - level: filter by log level (info, warn, error, debug)
 *   - limit: number of records to return (default: 100, max: 500)
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param model - Optional LogModel for testing (defaults to singleton)
 */
export async function getDebugLogs(
  req: Request,
  res: Response,
  model: LogModel = getLogModel()
): Promise<void> {
  try {
    // Parse and validate limit parameter
    const limitParam = req.query.limit;
    let limit = 100; // Default limit

    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 500); // Enforce maximum limit
      }
    }

    // Parse and validate level parameter
    const levelParam = req.query.level;
    let level: LogLevel | undefined;

    if (levelParam && isValidLogLevel(levelParam)) {
      level = levelParam;
    }

    const logs = await model.findRecent(limit, level);

    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Error retrieving debug logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve debug logs',
    });
  }
}

/**
 * DELETE /api/logs?days=30
 * Clears old debug logs
 * Query params:
 *   - days: delete logs older than this many days (default: 30)
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param model - Optional LogModel for testing (defaults to singleton)
 */
export async function clearLogs(
  req: Request,
  res: Response,
  model: LogModel = getLogModel()
): Promise<void> {
  try {
    // Parse and validate days parameter
    const daysParam = req.query.days;
    let days = 30; // Default to 30 days

    if (daysParam) {
      const parsed = parseInt(daysParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        days = parsed;
      }
    }

    const deletedCount = await model.deleteOlderThan(days);

    res.json({
      success: true,
      message: 'Logs cleared successfully',
      deletedCount,
    });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear logs',
    });
  }
}
