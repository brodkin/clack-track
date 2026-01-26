/**
 * Database-backed Session Middleware
 *
 * Replaces in-memory session storage with database persistence.
 * Sessions are stored with expiration and validated on each request.
 *
 * Features:
 * - Session stored in database for persistence across restarts
 * - HTTP-only secure cookies for session token
 * - Configurable session duration via SESSION_DURATION_DAYS
 * - Automatic expired session cleanup
 * - Session activity tracking (lastAccessedAt)
 *
 * Architecture:
 * - Single Responsibility: Each function handles one aspect of session management
 * - Dependency Inversion: Accepts repositories via parameters, not hardcoded imports
 * - Open/Closed: Can be extended with additional session data without modification
 *
 * @module web/middleware/session
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { SessionRepository } from '@/storage/repositories/session-repo.js';
import { UserRepository } from '@/storage/repositories/user-repo.js';
import { SessionRecord } from '@/storage/models/session.js';
import { UserRecord } from '@/storage/models/user.js';

/**
 * Cookie name for session token
 * Using a distinctive name to avoid conflicts with other applications
 */
export const SESSION_COOKIE_NAME = 'clack_session';

/**
 * Default session duration in days
 * Can be overridden via SESSION_DURATION_DAYS environment variable
 */
const DEFAULT_SESSION_DURATION_DAYS = 30;

/**
 * Get session duration in milliseconds
 * Reads from SESSION_DURATION_DAYS environment variable with default of 30 days
 *
 * @returns Session duration in milliseconds
 */
export function getSessionDurationMs(): number {
  const days = parseInt(process.env.SESSION_DURATION_DAYS || '', 10);
  const durationDays = isNaN(days) || days <= 0 ? DEFAULT_SESSION_DURATION_DAYS : days;
  return durationDays * 24 * 60 * 60 * 1000;
}

/**
 * Generate a cryptographically secure session token
 * Uses 32 bytes of random data encoded as hex (64 characters)
 *
 * @returns Hex-encoded random token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Extended Request type with session and user data
 */
export interface AuthenticatedRequest extends Request {
  session?: SessionRecord;
  user?: UserRecord;
}

/**
 * Create the session middleware that parses cookies
 * This should be applied early in the middleware chain
 *
 * @param sessionRepo - Session repository for database operations
 * @param userRepo - User repository for user lookups
 * @returns Express middleware function
 */
export function createSessionMiddleware(
  _sessionRepo: SessionRepository,
  _userRepo: UserRepository
): RequestHandler {
  // Return cookie parser - the actual session validation happens in requireAuth
  return cookieParser();
}

/**
 * Middleware to require authentication
 * Validates session token from cookie and attaches user/session to request
 *
 * @param sessionRepo - Session repository for database operations
 * @param userRepo - User repository for user lookups
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
 *   // req.user and req.session are available
 *   res.json({ user: req.user });
 * });
 * ```
 */
export function requireAuth(
  sessionRepo: SessionRepository,
  userRepo: UserRepository
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if already authenticated (e.g., by auth bypass middleware)
      const authReq = req as AuthenticatedRequest;
      if (authReq.user && authReq.session) {
        // Already authenticated - skip validation
        next();
        return;
      }

      // Get session token from cookie
      const token = req.cookies?.[SESSION_COOKIE_NAME];

      if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate session from database (checks expiration)
      const session = await sessionRepo.getValidSessionByToken(token);

      if (!session) {
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
      }

      // Look up the user
      const user = await userRepo.findById(session.userId);

      if (!user) {
        // Session exists but user was deleted - clean up the orphaned session
        await sessionRepo.deleteSession(session.id);
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
      }

      // Update last accessed time (fire-and-forget)
      sessionRepo.touchSession(session.id).catch(() => {
        // Ignore touch errors - not critical
      });

      // Attach session and user to request
      authReq.session = session;
      authReq.user = user;

      next();
    } catch (error) {
      console.error('Session validation error:', error);
      res.status(500).json({ error: 'Session validation failed' });
    }
  };
}

/**
 * Create a new session for a user
 * Generates token, stores in database, and sets HTTP-only cookie
 *
 * @param res - Express response for setting cookie
 * @param sessionRepo - Session repository for database operations
 * @param userId - User ID to create session for
 * @param data - Optional additional session data
 * @returns Created session or null on failure
 *
 * @example
 * ```typescript
 * // After successful login
 * const session = await createSession(res, sessionRepo, user.id);
 * if (session) {
 *   res.json({ success: true, user });
 * }
 * ```
 */
export async function createSession(
  res: Response,
  sessionRepo: SessionRepository,
  userId: number,
  data?: Record<string, unknown>
): Promise<SessionRecord | null> {
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getSessionDurationMs());

  const session = await sessionRepo.createSession({
    token,
    userId,
    expiresAt,
    createdAt: now,
    lastAccessedAt: now,
    data,
  });

  if (session) {
    // Set secure HTTP-only cookie
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: getSessionDurationMs(),
    });
  }

  return session;
}

/**
 * Destroy a session (logout)
 * Removes session from database and clears cookie
 *
 * @param req - Express request with session attached
 * @param res - Express response for clearing cookie
 * @param sessionRepo - Session repository for database operations
 * @returns true if session was destroyed, false otherwise
 *
 * @example
 * ```typescript
 * app.post('/logout', requireAuth(sessionRepo, userRepo), async (req, res) => {
 *   await destroySession(req, res, sessionRepo);
 *   res.json({ success: true });
 * });
 * ```
 */
export async function destroySession(
  req: Request,
  res: Response,
  sessionRepo: SessionRepository
): Promise<boolean> {
  const authReq = req as AuthenticatedRequest;
  const session = authReq.session;

  if (!session) {
    return false;
  }

  const deleted = await sessionRepo.deleteSession(session.id);

  // Always clear the cookie, even if database delete failed
  res.clearCookie(SESSION_COOKIE_NAME);

  return deleted;
}
