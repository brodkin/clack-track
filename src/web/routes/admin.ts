/**
 * Admin Routes
 *
 * API endpoints for administrative functions.
 * All routes require authentication via requireAuth middleware.
 *
 * Endpoints:
 * - POST /api/admin/invite - Generate magic link invite for user registration
 *
 * Architecture:
 * - Single Responsibility: Each route handles one admin operation
 * - Dependency Inversion: Uses injected repositories and services
 * - Open/Closed: Extensible via additional admin endpoints
 */

import { Router, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { requireAuth, type AuthenticatedRequest } from '../middleware/session.js';
import type { SessionRepository } from '../../storage/repositories/session-repo.js';
import type { UserRepository } from '../../storage/repositories/user-repo.js';
import type { MagicLinkRepository } from '../../storage/repositories/magic-link-repo.js';
import { MagicLinkService, MagicLinkError } from '../../auth/magic-link-service.js';

/**
 * Dependencies for admin routes
 */
export interface AdminDependencies {
  sessionRepository: SessionRepository;
  userRepository: UserRepository;
  magicLinkRepository: MagicLinkRepository;
}

/**
 * Email validation regex
 * Validates standard email format: local@domain.tld
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Generate magic link invite for user registration
 *
 * POST /api/admin/invite
 *
 * Request body:
 * - email: string - Email address for the invite
 *
 * Response:
 * - 200: { success: true, link: string, email: string, expiresAt: string }
 * - 400: { error: string } - Invalid email format
 * - 409: { error: string } - Email already has a pending invite
 * - 401: { error: string } - Authentication required
 * - 500: { error: string } - Server error
 */
function createGenerateInviteHandler(deps: AdminDependencies) {
  const magicLinkService = new MagicLinkService(deps.magicLinkRepository);

  return async function generateInvite(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      // Validate email is provided
      if (!email || typeof email !== 'string') {
        res.status(400).json({
          error: 'Email is required',
        });
        return;
      }

      // Validate email format
      const trimmedEmail = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        res.status(400).json({
          error: 'Please enter a valid email address',
        });
        return;
      }

      // Check for existing pending invite
      const hasExisting = await magicLinkService.hasValidInvite(trimmedEmail);
      if (hasExisting) {
        res.status(409).json({
          error: 'Email already has a pending invite',
        });
        return;
      }

      // Get the authenticated user's ID for tracking who created the invite
      const authReq = req as AuthenticatedRequest;
      const createdBy = authReq.user?.id ?? null;

      // Generate the magic link
      const result = await magicLinkService.generate(trimmedEmail, createdBy);

      // Build the full registration URL
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const link = `${baseUrl}/register?token=${result.token}`;

      res.status(200).json({
        success: true,
        link,
        email: result.email,
        expiresAt: result.expiresAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof MagicLinkError) {
        res.status(500).json({
          error: error.message,
        });
        return;
      }

      console.error('Error generating invite:', error);
      res.status(500).json({
        error: 'Failed to generate invite',
      });
    }
  };
}

/**
 * Create and configure admin router
 *
 * @param deps - Dependencies for admin functionality
 * @returns Express router with admin routes
 *
 * @example
 * ```typescript
 * const adminRouter = createAdminRouter({
 *   sessionRepository,
 *   userRepository,
 *   magicLinkRepository,
 * });
 * app.use('/api/admin', adminRouter);
 * ```
 */
export function createAdminRouter(deps: AdminDependencies): Router {
  const router = Router();

  // Parse cookies for session token
  router.use(cookieParser());

  // All admin routes require authentication
  router.use(requireAuth(deps.sessionRepository, deps.userRepository));

  // Invite generation
  router.post('/invite', createGenerateInviteHandler(deps));

  return router;
}
