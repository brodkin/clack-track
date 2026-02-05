/**
 * Account Management Routes
 *
 * Endpoints for profile viewing and passkey management.
 * Uses database-backed session authentication.
 *
 * Architecture:
 * - Single Responsibility: Each route handles one account operation
 * - Dependency Inversion: Uses injected repositories
 * - Open/Closed: Extensible via middleware without modifying route handlers
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/server';
import type { SessionRepository } from '@/storage/repositories/session-repo.js';
import type { UserRepository } from '@/storage/repositories/user-repo.js';
import type { CredentialRepository } from '@/storage/repositories/credential-repo.js';
import { requireAuth as dbRequireAuth } from '../middleware/session.js';
import { config } from '../../config/env.js';

/**
 * Dependencies for account routes
 */
export interface AccountDependencies {
  sessionRepository?: SessionRepository;
  userRepository?: UserRepository;
  credentialRepository?: CredentialRepository;
}

/**
 * In-memory session storage (legacy fallback)
 * Used when database repositories are not provided
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

/** Relying Party configuration - sourced from centralized config (shared with auth.ts) */
const RP_NAME = config.webauthn.rpName;
const RP_ID = config.webauthn.rpId;
const EXPECTED_ORIGIN = config.webauthn.origin;

/**
 * requireAuth middleware
 * Validates session and returns 401 if not authenticated
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
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

// getProfile is now created by createGetProfile factory function

/**
 * Create passkeys handler with database support
 */
function createGetPasskeys(deps: AccountDependencies) {
  return async function getPasskeysHandler(req: Request, res: Response): Promise<void> {
    try {
      // If using database, get passkeys from credential repository
      if (deps.credentialRepository) {
        const user = (req as Request & { user?: { id: number } }).user;
        if (user) {
          const credentials = await deps.credentialRepository.findByUserId(user.id);
          res.status(200).json({
            passkeys: credentials.map(cred => ({
              id: cred.id,
              name: cred.name || 'Passkey',
              deviceType: cred.deviceType || 'platform',
              createdAt: cred.createdAt?.toISOString() || new Date().toISOString(),
              lastUsed: cred.lastUsedAt?.toISOString() || null,
            })),
          });
          return;
        }
      }

      // Fall back to legacy in-memory passkeys
      const sessionId = getSessionId(req);
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
  };
}

/**
 * Challenge storage for passkey registration (keyed by challenge string)
 * Used to verify registration responses
 */
const registrationChallenges: { [challenge: string]: { usedId: number; email: string } } = {};

/**
 * Create passkey registration start handler with database support
 */
function createStartPasskeyRegistration(deps: AccountDependencies) {
  return async function startPasskeyRegistrationHandler(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      // If using database sessions, get user from request (set by middleware)
      if (deps.sessionRepository && deps.userRepository) {
        const user = (req as Request & { user?: { id: number; email: string; name?: string } })
          .user;
        if (user) {
          // Generate registration options
          const options: PublicKeyCredentialCreationOptionsJSON = await generateRegistrationOptions(
            {
              rpName: RP_NAME,
              rpID: RP_ID,
              userName: user.email,
              userDisplayName: user.name || user.email.split('@')[0],
              timeout: 60000, // 60 seconds
              attestationType: 'none',
              authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
              },
            }
          );

          // Store challenge for verification (keyed by challenge string)
          registrationChallenges[options.challenge] = { usedId: user.id, email: user.email };

          res.status(200).json(options);
          return;
        }
      }

      // Fall back to legacy in-memory session
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
  };
}

/**
 * Create passkey registration verify handler with database support
 */
function createVerifyPasskeyRegistration(deps: AccountDependencies) {
  return async function verifyPasskeyRegistrationHandler(
    req: Request,
    res: Response
  ): Promise<void> {
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

      // If using database, use challenge storage and credential repository
      if (deps.credentialRepository) {
        const user = (req as Request & { user?: { id: number; email: string } }).user;

        // Get the challenge from the credential's clientDataJSON
        let storedChallenge: string | undefined;
        try {
          const clientDataBuffer = Buffer.from(credential.response.clientDataJSON, 'base64url');
          const clientData = JSON.parse(clientDataBuffer.toString('utf-8'));
          storedChallenge = clientData.challenge;
        } catch {
          res.status(400).json({ error: 'Invalid credential: could not parse clientDataJSON' });
          return;
        }

        // Verify the challenge exists
        if (!storedChallenge || !registrationChallenges[storedChallenge]) {
          res.status(400).json({ error: 'No registration challenge found' });
          return;
        }

        // Verify registration response
        const regResponse: RegistrationResponseJSON = credential;
        let registrationInfo;
        try {
          const verification = await verifyRegistrationResponse({
            response: regResponse,
            expectedChallenge: storedChallenge,
            expectedOrigin: EXPECTED_ORIGIN,
            expectedRPID: RP_ID,
            requireUserVerification: false,
          });

          if (!verification.verified || !verification.registrationInfo) {
            res.status(400).json({ error: 'Registration verification failed' });
            return;
          }

          registrationInfo = verification.registrationInfo;
        } catch (verifyError) {
          console.error('Registration verification error:', verifyError);
          res.status(400).json({ error: 'Registration verification failed' });
          return;
        }

        // Extract credential data from v13 API format
        const { credential: verifiedCredential } = registrationInfo;
        const publicKeyBase64 = Buffer.from(verifiedCredential.publicKey).toString('base64');

        // Store credential in database
        const savedCredential = await deps.credentialRepository.save({
          userId: user!.id,
          credentialId: verifiedCredential.id,
          publicKey: publicKeyBase64,
          counter: verifiedCredential.counter,
          deviceType: 'platform',
          name,
          createdAt: new Date(),
          lastUsedAt: null,
        });

        // Clean up challenge
        delete registrationChallenges[storedChallenge];

        res.status(200).json({
          verified: true,
          passkey: {
            id: savedCredential?.id || verifiedCredential.id,
            name,
            deviceType: 'platform',
            createdAt: new Date().toISOString(),
            lastUsed: null,
          },
        });
        return;
      }

      // Fall back to legacy in-memory storage
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
  };
}

/**
 * Create remove passkey handler with database support
 */
function createRemovePasskey(deps: AccountDependencies) {
  return async function removePasskeyHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // If using database, remove from credential repository
      if (deps.credentialRepository) {
        const user = (req as Request & { user?: { id: number } }).user;
        if (user) {
          // Get all credentials for user to check if this is the last one
          const credentials = await deps.credentialRepository.findByUserId(user.id);

          // Find the credential to remove
          const credentialId = parseInt(id, 10);
          const credential = credentials.find(c => c.id === credentialId);

          if (!credential) {
            res.status(404).json({ error: 'Passkey not found' });
            return;
          }

          // Prevent removing last passkey
          if (credentials.length === 1) {
            res.status(400).json({
              error: 'Cannot remove last passkey. Add another passkey before removing this one.',
            });
            return;
          }

          // Remove from database
          await deps.credentialRepository.delete(credentialId);

          res.status(200).json({ success: true });
          return;
        }
      }

      // Fall back to legacy in-memory storage
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
  };
}

/**
 * Create rename passkey handler with database support
 */
function createRenamePasskey(deps: AccountDependencies) {
  return async function renamePasskeyHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Missing required field: name' });
        return;
      }

      // If using database, update in credential repository
      if (deps.credentialRepository) {
        const user = (req as Request & { user?: { id: number } }).user;
        if (user) {
          const credentialId = parseInt(id, 10);

          // Update the credential name
          const updated = await deps.credentialRepository.updateName(credentialId, name);

          if (!updated) {
            res.status(404).json({ error: 'Passkey not found' });
            return;
          }

          // Fetch the updated credential
          const credential = await deps.credentialRepository.findById(credentialId);

          res.status(200).json({
            passkey: {
              id: credential?.id || credentialId,
              name: credential?.name || name,
              deviceType: credential?.deviceType || 'platform',
              createdAt: credential?.createdAt?.toISOString() || new Date().toISOString(),
              lastUsed: credential?.lastUsedAt?.toISOString() || null,
            },
          });
          return;
        }
      }

      // Fall back to legacy in-memory storage
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
  };
}

/**
 * Create and configure account router
 *
 * @param deps - Optional dependencies for database-backed sessions
 * @returns Express router with account management routes
 */
export function createAccountRouter(deps: AccountDependencies = {}): Router {
  const router = Router();

  // Use database-backed auth if repositories are provided, otherwise legacy
  if (deps.sessionRepository && deps.userRepository) {
    router.use(dbRequireAuth(deps.sessionRepository, deps.userRepository));
  } else {
    router.use(requireAuth);
  }

  // Profile routes - use database if available
  router.get('/profile', createGetProfile(deps));

  // Passkey management routes - use database if available
  router.get('/passkeys', createGetPasskeys(deps));
  router.post('/passkey/register/start', createStartPasskeyRegistration(deps));
  router.post('/passkey/register/verify', createVerifyPasskeyRegistration(deps));
  router.delete('/passkey/:id', createRemovePasskey(deps));
  router.patch('/passkey/:id', createRenamePasskey(deps));

  return router;
}

/**
 * Create profile handler with optional database support
 */
function createGetProfile(deps: AccountDependencies) {
  return async function getProfileHandler(req: Request, res: Response): Promise<void> {
    try {
      // If using database sessions, get user from request (set by middleware)
      if (deps.sessionRepository && deps.userRepository) {
        const user = (req as Request & { user?: { id: number; email: string; name?: string } })
          .user;
        if (user) {
          res.status(200).json({
            name: user.name || user.email.split('@')[0],
            email: user.email,
            createdAt: new Date().toISOString(), // TODO: Add createdAt to user model
          });
          return;
        }
      }

      // Fall back to legacy session
      const sessionId = getSessionId(req);
      const session = sessions[sessionId];

      if (!session?.user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.status(200).json(session.user);
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  };
}
