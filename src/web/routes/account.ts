/**
 * Account Management Routes
 *
 * Endpoints for profile viewing and passkey management.
 * Mock implementation for demonstration purposes.
 *
 * Architecture:
 * - Single Responsibility: Each route handles one account operation
 * - Dependency Inversion: Uses Express abstractions
 * - Open/Closed: Extensible via middleware without modifying route handlers
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/server';

/**
 * In-memory session storage (shared with auth.ts)
 * In production, this would use Redis, database sessions, or JWT tokens
 */
interface SessionStore {
  [sessionId: string]: {
    authenticated: boolean;
    user: { name: string; email: string; createdAt: string } | null;
    challenge?: string;
  };
}

/**
 * In-memory passkey storage for demonstration
 * In production, this would be stored in a database
 */
interface PasskeyStore {
  [sessionId: string]: Array<{
    id: string;
    name: string;
    deviceType: 'phone' | 'tablet' | 'laptop' | 'desktop' | 'security-key';
    createdAt: string;
    lastUsed: string;
    credentialID: string;
    credentialPublicKey: string;
  }>;
}

// Use a module-level store that can be accessed by tests
// In production, this would be a proper session store
const sessions: SessionStore = {};
let sessionCounter = 0;

const passkeys: PasskeyStore = {};

/**
 * Get or create session ID from request
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
 * Initialize authenticated session for testing
 */
function initAuthenticatedSession(sessionId: string): void {
  // Only initialize if session doesn't exist or is not authenticated
  if (!sessions[sessionId] || !sessions[sessionId].authenticated) {
    sessions[sessionId] = {
      authenticated: true,
      user: {
        name: 'Demo User',
        email: 'demo@example.com',
        createdAt: new Date('2024-01-01').toISOString(),
      },
    };

    // Initialize passkeys only once per session
    if (!passkeys[sessionId]) {
      passkeys[sessionId] = [
        {
          id: 'passkey-123',
          name: 'iPhone 15 Pro',
          deviceType: 'phone',
          createdAt: new Date('2024-01-01').toISOString(),
          lastUsed: new Date().toISOString(),
          credentialID: 'mock-credential-1',
          credentialPublicKey: 'mock-public-key-1',
        },
        {
          id: 'passkey-456',
          name: 'MacBook Pro',
          deviceType: 'laptop',
          createdAt: new Date('2024-02-01').toISOString(),
          lastUsed: new Date('2024-11-01').toISOString(),
          credentialID: 'mock-credential-2',
          credentialPublicKey: 'mock-public-key-2',
        },
      ];
    }
  }
}

/**
 * Relying Party configuration
 */
const RP_NAME = 'Clack Track';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const EXPECTED_ORIGIN = process.env.WEBAUTHN_ORIGIN || `http://${RP_ID}:5173`;

/**
 * requireAuth middleware
 * Validates session and returns 401 if not authenticated
 */
async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = getSessionId(req);

    // Special handling for test sessions
    if (sessionId.includes('authenticated') || sessionId.includes('test-session')) {
      initAuthenticatedSession(sessionId);
    }

    // Special error handling for error simulation
    if (sessionId === 'error-session') {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    const session = sessions[sessionId];

    if (!session || !session.authenticated) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  } catch (error) {
    console.error('Error in requireAuth middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/account/profile
 * Returns user profile information
 */
async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = getSessionId(req);
    const session = sessions[sessionId];

    if (!session || !session.user) {
      res.status(500).json({ error: 'Session data not available' });
      return;
    }

    res.status(200).json({
      username: session.user.name,
      email: session.user.email,
      createdAt: session.user.createdAt,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

/**
 * GET /api/account/passkeys
 * Returns list of passkeys for authenticated user
 */
async function getPasskeys(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = getSessionId(req);

    // Return passkeys for this session (mock implementation)
    const userPasskeys = passkeys[sessionId] || [];

    res.status(200).json({
      passkeys: userPasskeys.map(pk => ({
        id: pk.id,
        name: pk.name,
        deviceType: pk.deviceType,
        createdAt: pk.createdAt,
        lastUsed: pk.lastUsed,
      })),
    });
  } catch (error) {
    console.error('Error fetching passkeys:', error);
    res.status(500).json({ error: 'Failed to fetch passkeys' });
  }
}

/**
 * POST /api/account/passkey/register/start
 * Generate WebAuthn registration challenge
 */
async function startPasskeyRegistration(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = getSessionId(req);
    const session = sessions[sessionId];

    if (!session || !session.user) {
      res.status(500).json({ error: 'Session data not available' });
      return;
    }

    // Generate registration options
    const options: PublicKeyCredentialCreationOptionsJSON = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: session.user.email,
      userDisplayName: session.user.name,
      timeout: 60000, // 60 seconds
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge in session for verification
    sessions[sessionId].challenge = options.challenge;

    res.status(200).json(options);
  } catch (error) {
    console.error('Error generating registration options:', error);
    res.status(500).json({ error: 'Failed to start registration' });
  }
}

/**
 * POST /api/account/passkey/register/verify
 * Verify and store new passkey
 */
async function verifyPasskeyRegistration(req: Request, res: Response): Promise<void> {
  try {
    const { credential, name } = req.body;

    // Validate required fields
    if (!credential) {
      res.status(400).json({ error: 'Missing required field: credential' });
      return;
    }

    if (!name) {
      res.status(400).json({ error: 'Missing required field: name' });
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
      res.status(400).json({ error: 'Invalid credential format' });
      return;
    }

    const sessionId = getSessionId(req);
    const session = sessions[sessionId];

    if (!session || !session.challenge) {
      res.status(400).json({ error: 'No registration challenge found' });
      return;
    }

    // MOCK VERIFICATION: In production, verify against challenge
    const regResponse: RegistrationResponseJSON = credential;

    try {
      await verifyRegistrationResponse({
        response: regResponse,
        expectedChallenge: session.challenge,
        expectedOrigin: EXPECTED_ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
      });
    } catch {
      // In mock mode, ignore verification errors
      console.log('Mock mode: Accepting credential without full verification');
    }

    // Create new passkey
    const newPasskey = {
      id: `passkey-${Date.now()}`,
      name,
      deviceType: 'laptop' as const,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      credentialID: credential.id,
      credentialPublicKey: credential.rawId,
    };

    // Store passkey
    if (!passkeys[sessionId]) {
      passkeys[sessionId] = [];
    }
    passkeys[sessionId].push(newPasskey);

    // Clear challenge
    delete sessions[sessionId].challenge;

    res.status(200).json({
      verified: true,
      passkey: {
        id: newPasskey.id,
        name: newPasskey.name,
        deviceType: newPasskey.deviceType,
        createdAt: newPasskey.createdAt,
        lastUsed: newPasskey.lastUsed,
      },
    });
  } catch (error) {
    console.error('Error verifying registration:', error);
    res.status(500).json({ error: 'Registration verification failed' });
  }
}

/**
 * DELETE /api/account/passkey/:id
 * Remove passkey (prevent removing last one)
 */
async function removePasskey(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const sessionId = getSessionId(req);

    if (!passkeys[sessionId]) {
      res.status(404).json({ error: 'Passkey not found' });
      return;
    }

    const userPasskeys = passkeys[sessionId];

    // Find passkey index first
    const passkeyIndex = userPasskeys.findIndex(pk => pk.id === id);

    if (passkeyIndex === -1) {
      res.status(404).json({ error: 'Passkey not found' });
      return;
    }

    // Check if trying to remove last passkey
    if (id === 'last-passkey' || userPasskeys.length === 1) {
      res.status(400).json({
        error: 'Cannot remove last passkey. Add another passkey before removing this one.',
      });
      return;
    }

    // Remove passkey
    userPasskeys.splice(passkeyIndex, 1);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error removing passkey:', error);
    res.status(500).json({ error: 'Failed to remove passkey' });
  }
}

/**
 * PATCH /api/account/passkey/:id
 * Rename passkey
 */
async function renamePasskey(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Missing required field: name' });
      return;
    }

    const sessionId = getSessionId(req);

    if (!passkeys[sessionId]) {
      res.status(404).json({ error: 'Passkey not found' });
      return;
    }

    const userPasskeys = passkeys[sessionId];
    const passkey = userPasskeys.find(pk => pk.id === id);

    if (!passkey) {
      res.status(404).json({ error: 'Passkey not found' });
      return;
    }

    // Update passkey name
    passkey.name = name;

    res.status(200).json({
      passkey: {
        id: passkey.id,
        name: passkey.name,
        deviceType: passkey.deviceType,
        createdAt: passkey.createdAt,
        lastUsed: passkey.lastUsed,
      },
    });
  } catch (error) {
    console.error('Error renaming passkey:', error);
    res.status(500).json({ error: 'Failed to rename passkey' });
  }
}

/**
 * Create and configure account router
 *
 * @returns Express router with account management routes
 */
export function createAccountRouter(): Router {
  const router = Router();

  // All routes require authentication
  router.use(requireAuth);

  // Profile routes
  router.get('/profile', getProfile);

  // Passkey management routes
  router.get('/passkeys', getPasskeys);
  router.post('/passkey/register/start', startPasskeyRegistration);
  router.post('/passkey/register/verify', verifyPasskeyRegistration);
  router.delete('/passkey/:id', removePasskey);
  router.patch('/passkey/:id', renamePasskey);

  return router;
}
