/**
 * Authentication Routes
 *
 * WebAuthn/passkey authentication endpoints for login-only flow.
 * Mock implementation that accepts any valid WebAuthn response.
 *
 * Architecture:
 * - Single Responsibility: Each route handles one authentication operation
 * - Dependency Inversion: Uses Express abstractions, not concrete implementations
 * - Open/Closed: Extensible via middleware without modifying route handlers
 */

import { Router, type Request, type Response } from 'express';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';

/**
 * In-memory session storage for demonstration purposes
 * In production, this would use Redis, database sessions, or JWT tokens
 */
interface SessionStore {
  [sessionId: string]: {
    authenticated: boolean;
    user: { name: string } | null;
    challenge?: string;
  };
}

const sessions: SessionStore = {};
let sessionCounter = 0;

/**
 * Get or create session ID from request
 * In production, this would use express-session or similar
 */
function getSessionId(req: Request): string {
  let sessionId = req.headers['x-session-id'] as string | undefined;
  if (!sessionId) {
    sessionId = `session-${++sessionCounter}`;
  }
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      authenticated: false,
      user: null,
    };
  }
  return sessionId;
}

/**
 * Relying Party configuration
 * These would typically come from environment variables
 */
const RP_NAME = 'Clack Track';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const EXPECTED_ORIGIN = process.env.WEBAUTHN_ORIGIN || `http://${RP_ID}:5173`;

/**
 * POST /api/auth/login/start
 * Generate authentication challenge for passkey login
 */
async function startLogin(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = getSessionId(req);

    // Generate authentication options
    const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      timeout: 60000, // 60 seconds
    });

    // Store challenge in session for verification
    sessions[sessionId].challenge = options.challenge;

    // Send options to client with session ID
    res.status(200).json({
      ...options,
      rpName: RP_NAME,
    });
  } catch (error) {
    console.error('Error generating authentication options:', error);
    res.status(500).json({
      error: 'Failed to start authentication',
    });
  }
}

/**
 * POST /api/auth/login/verify
 * Verify WebAuthn authentication response
 *
 * MOCK IMPLEMENTATION: Accepts any valid WebAuthn response structure
 * In production, this would validate against stored credentials
 */
async function verifyLogin(req: Request, res: Response): Promise<void> {
  try {
    const { credential, challenge } = req.body;

    // Validate required fields
    if (!credential) {
      res.status(400).json({
        error: 'Missing required field: credential',
      });
      return;
    }

    if (!challenge) {
      res.status(400).json({
        error: 'Missing required field: challenge',
      });
      return;
    }

    // Validate credential structure
    if (
      !credential.id ||
      !credential.rawId ||
      !credential.response ||
      !credential.type ||
      credential.type !== 'public-key'
    ) {
      res.status(400).json({
        error: 'Invalid credential format',
      });
      return;
    }

    const sessionId = getSessionId(req);

    // Verify challenge matches session
    if (sessions[sessionId].challenge !== challenge) {
      res.status(400).json({
        error: 'Invalid challenge',
      });
      return;
    }

    // MOCK VERIFICATION: In production, verify against stored public key
    // For now, accept any valid WebAuthn response structure
    const authResponse: AuthenticationResponseJSON = credential;

    try {
      // Verify the response structure (not cryptographic verification in mock mode)
      await verifyAuthenticationResponse({
        response: authResponse,
        expectedChallenge: challenge,
        expectedOrigin: EXPECTED_ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false, // Mock mode: accept without UV
        // @ts-expect-error - Mock mode: authenticator not stored yet
        authenticator: {
          credentialID: new Uint8Array(),
          credentialPublicKey: new Uint8Array(),
          counter: 0,
          transports: [],
        },
      });
    } catch {
      // In mock mode, ignore verification errors from missing authenticator
      // This allows us to test the flow before we have user registration
      console.log('Mock mode: Accepting credential without full verification');
    }

    // Mark session as authenticated (mock user)
    sessions[sessionId].authenticated = true;
    sessions[sessionId].user = { name: 'Demo User' };
    delete sessions[sessionId].challenge;

    res.status(200).json({
      verified: true,
      user: sessions[sessionId].user,
    });
  } catch (error) {
    console.error('Error verifying authentication:', error);
    res.status(500).json({
      error: 'Authentication verification failed',
    });
  }
}

/**
 * POST /api/auth/logout
 * Clear authentication session
 */
async function logout(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = getSessionId(req);

    // Clear session data
    sessions[sessionId].authenticated = false;
    sessions[sessionId].user = null;
    delete sessions[sessionId].challenge;

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({
      error: 'Logout failed',
    });
  }
}

/**
 * GET /api/auth/session
 * Check current authentication status
 */
async function checkSession(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = getSessionId(req);
    const session = sessions[sessionId];

    res.status(200).json({
      authenticated: session.authenticated,
      user: session.user,
    });
  } catch (error) {
    console.error('Error checking session:', error);
    res.status(500).json({
      error: 'Failed to check session',
    });
  }
}

/**
 * Create and configure authentication router
 *
 * @returns Express router with authentication routes
 */
export function createAuthRouter(): Router {
  const router = Router();

  router.post('/login/start', startLogin);
  router.post('/login/verify', verifyLogin);
  router.post('/logout', logout);
  router.get('/session', checkSession);

  return router;
}
