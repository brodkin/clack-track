/**
 * Auth Bypass Middleware for Automated Testing
 *
 * Enables automated tests (e.g., Playwright) to authenticate without
 * going through the full WebAuthn/magic link flow.
 *
 * Security guarantees:
 * - Disabled by default (AUTH_BYPASS_ENABLED must be explicitly set to 'true')
 * - Hard block in production (NODE_ENV === 'production' always disables bypass)
 * - Creates real sessions that work with requireAuth middleware
 * - Sessions are marked with audit data (authBypass: true, source: 'playwright')
 *
 * Usage in Playwright tests:
 * ```typescript
 * // Set the bypass header on requests
 * await page.setExtraHTTPHeaders({
 *   'X-Auth-Bypass': 'test@playwright.local'
 * });
 * ```
 *
 * @module web/middleware/auth-bypass
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { SessionRepository } from '@/storage/repositories/session-repo.js';
import { UserRepository } from '@/storage/repositories/user-repo.js';
import { createSession, AuthenticatedRequest } from './session.js';

/**
 * Header name for auth bypass requests
 * Playwright tests should set this header with the user email/ID to authenticate as
 */
export const AUTH_BYPASS_HEADER = 'X-Auth-Bypass';

/**
 * Default name assigned to auto-created test users
 */
const DEFAULT_TEST_USER_NAME = 'Test User (Playwright)';

/**
 * Check if auth bypass is enabled
 *
 * Bypass is enabled ONLY when:
 * 1. AUTH_BYPASS_ENABLED environment variable is set to 'true' (case-insensitive)
 * 2. NODE_ENV is NOT 'production' (hard block - cannot be bypassed)
 *
 * @returns true if bypass is enabled and safe to use
 */
export function isAuthBypassEnabled(): boolean {
  // Hard block in production - this cannot be overridden
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // Check if explicitly enabled (case-insensitive)
  const enabled = process.env.AUTH_BYPASS_ENABLED?.toLowerCase() === 'true';
  return enabled;
}

/**
 * Create auth bypass middleware for automated testing
 *
 * This middleware should be applied BEFORE requireAuth in the middleware chain.
 * When enabled and the bypass header is present, it:
 * 1. Looks up or creates the user by email
 * 2. Creates a valid session
 * 3. Sets the session cookie
 * 4. Attaches user and session to the request
 *
 * When disabled or header is not present, it passes through to next middleware.
 *
 * @param sessionRepo - Session repository for session creation
 * @param userRepo - User repository for user lookup/creation
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
 * app.use(bypassMiddleware);
 * app.get('/protected', requireAuth(sessionRepo, userRepo), handler);
 * ```
 */
export function createAuthBypassMiddleware(
  sessionRepo: SessionRepository,
  userRepo: UserRepository
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Check if bypass is enabled (includes production hard block)
    if (!isAuthBypassEnabled()) {
      // Pass through to next middleware (likely requireAuth will handle)
      next();
      return;
    }

    // Check for bypass header
    const bypassValue = req.get(AUTH_BYPASS_HEADER);

    // If no header or empty/whitespace value, pass through
    if (!bypassValue || bypassValue.trim() === '') {
      next();
      return;
    }

    const email = bypassValue.trim().toLowerCase();

    try {
      // Look up or create user using getOrCreateByEmail for atomicity
      const user = await userRepo.getOrCreateByEmail(email, DEFAULT_TEST_USER_NAME);

      if (!user) {
        // Failed to create user - let requireAuth handle the 401
        console.warn('[auth-bypass] Failed to get or create test user:', email);
        next();
        return;
      }

      // Create session with audit data
      const session = await createSession(res, sessionRepo, user.id, {
        authBypass: true,
        source: 'playwright',
      });

      if (!session) {
        // Failed to create session - let requireAuth handle the 401
        console.warn('[auth-bypass] Failed to create session for user:', email);
        next();
        return;
      }

      // Attach user and session to request (same as requireAuth does)
      const authReq = req as AuthenticatedRequest;
      authReq.user = user;
      authReq.session = session;

      // Continue to next middleware (session is now valid)
      next();
    } catch (error) {
      // Log error but don't fail - let requireAuth handle authentication
      console.error('[auth-bypass] Error during bypass authentication:', error);
      next();
    }
  };
}
