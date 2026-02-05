/**
 * Authentication Routes
 *
 * WebAuthn/passkey authentication endpoints for login and registration flows.
 * Supports both real credential verification and mock mode (when no repository provided).
 *
 * Session Management:
 * - Database-backed sessions for persistence across server restarts
 * - HTTP-only secure cookies for session tokens
 * - Configurable session duration via SESSION_DURATION_DAYS
 *
 * Registration Flow:
 * - Token validation via MagicLinkService
 * - User creation with passkey credential
 * - Automatic session creation after registration
 *
 * Architecture:
 * - Single Responsibility: Each route handles one authentication operation
 * - Dependency Inversion: Uses injected repositories for credential verification
 * - Open/Closed: Extensible via middleware without modifying route handlers
 */

import { Router, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import type { CredentialRepository } from '../../storage/repositories/credential-repo.js';
import type { UserRepository } from '../../storage/repositories/user-repo.js';
import type { SessionRepository } from '../../storage/repositories/session-repo.js';
import type { MagicLinkService } from '../../auth/magic-link-service.js';
import { createSession, destroySession, SESSION_COOKIE_NAME } from '../middleware/session.js';
import { config } from '../../config/env.js';

/**
 * Dependencies for auth routes
 * When provided, enables real credential verification and database sessions
 * When not provided, falls back to mock mode for testing
 */
export interface AuthDependencies {
  credentialRepository?: CredentialRepository;
  userRepository?: UserRepository;
  sessionRepository?: SessionRepository;
  magicLinkService?: MagicLinkService;
}

/**
 * In-memory challenge storage (short-lived, for WebAuthn flow only)
 * Challenges are temporary and don't need database persistence
 * They expire after 60 seconds per WebAuthn timeout
 */
interface ChallengeStore {
  [challengeId: string]: {
    challenge: string;
    createdAt: number;
  };
}

const challenges: ChallengeStore = {};

// Clean up expired challenges every 5 minutes
const challengeCleanupInterval = setInterval(
  () => {
    const now = Date.now();
    const expiryMs = 60000; // 60 seconds (matches WebAuthn timeout)
    for (const challengeId of Object.keys(challenges)) {
      if (now - challenges[challengeId].createdAt > expiryMs) {
        delete challenges[challengeId];
      }
    }
  },
  5 * 60 * 1000
);

// Prevent cleanup interval from keeping Node.js process alive
challengeCleanupInterval.unref();

/**
 * Legacy in-memory session storage for backward compatibility
 * Used when sessionRepository is not provided (mock mode)
 */
interface SessionStore {
  [sessionId: string]: {
    authenticated: boolean;
    user: { id?: number; name: string } | null;
    challenge?: string;
  };
}

const legacySessions: SessionStore = {};
let sessionCounter = 0;

/**
 * Get or create legacy session ID from request (for mock mode)
 */
function getLegacySessionId(req: Request): string {
  let sessionId = req.headers['x-session-id'] as string | undefined;
  if (!sessionId) {
    sessionId = `session-${++sessionCounter}`;
  }
  if (!legacySessions[sessionId]) {
    legacySessions[sessionId] = {
      authenticated: false,
      user: null,
    };
  }
  return sessionId;
}

/** Relying Party configuration - sourced from centralized config */
const RP_NAME = config.webauthn.rpName;
const RP_ID = config.webauthn.rpId;
const EXPECTED_ORIGIN = config.webauthn.origin;

/**
 * Create startLogin handler with optional dependencies
 * Stores challenge in memory (short-lived, 60 second timeout)
 */
function createStartLoginHandler(deps: AuthDependencies) {
  return async function startLogin(req: Request, res: Response): Promise<void> {
    try {
      // Generate authentication options
      const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: 'preferred',
        timeout: 60000, // 60 seconds
      });

      // Store challenge for verification (in-memory, short-lived)
      // Use the challenge itself as the key for stateless verification
      challenges[options.challenge] = {
        challenge: options.challenge,
        createdAt: Date.now(),
      };

      // Also store in legacy session if using mock mode
      if (!deps.sessionRepository) {
        const sessionId = getLegacySessionId(req);
        legacySessions[sessionId].challenge = options.challenge;
      }

      // Send options to client
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
  };
}

/**
 * Create verifyLogin handler with optional dependencies
 * When dependencies are provided, performs real credential verification:
 * - Looks up credential in database
 * - Validates counter to prevent replay attacks
 * - Updates counter and lastUsedAt on success
 * - Creates database-backed session on success
 *
 * When dependencies are not provided, falls back to mock mode for testing.
 */
function createVerifyLoginHandler(deps: AuthDependencies) {
  return async function verifyLogin(req: Request, res: Response): Promise<void> {
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

      // Verify challenge exists (either in challenges store or legacy session)
      const challengeValid = challenges[challenge] !== undefined;
      let legacyChallengeValid = false;

      if (!deps.sessionRepository) {
        const sessionId = getLegacySessionId(req);
        legacyChallengeValid = legacySessions[sessionId]?.challenge === challenge;
      }

      if (!challengeValid && !legacyChallengeValid) {
        res.status(400).json({
          error: 'Invalid challenge',
        });
        return;
      }

      // Remove used challenge to prevent replay
      delete challenges[challenge];

      const authResponse: AuthenticationResponseJSON = credential;

      // Real credential verification when repository is available
      if (deps.credentialRepository) {
        // Look up credential in database
        const storedCredential = await deps.credentialRepository.findByCredentialId(credential.id);

        if (!storedCredential) {
          res.status(401).json({
            error: 'Credential not found',
          });
          return;
        }

        // Convert base64 public key to Uint8Array for verification
        const publicKeyBytes = new Uint8Array(Buffer.from(storedCredential.publicKey, 'base64'));

        let newCounter = storedCredential.counter;

        try {
          // Cryptographic verification with @simplewebauthn/server
          // This validates the signature, origin, challenge, and counter
          const verification = await verifyAuthenticationResponse({
            response: authResponse,
            expectedChallenge: challenge,
            expectedOrigin: EXPECTED_ORIGIN,
            expectedRPID: RP_ID,
            requireUserVerification: false,
            credential: {
              id: storedCredential.credentialId, // Base64URL string
              publicKey: publicKeyBytes,
              counter: storedCredential.counter,
              transports: [],
            },
          });

          if (!verification.verified) {
            res.status(401).json({
              error: 'Authentication verification failed',
            });
            return;
          }

          // Get new counter from verification result
          newCounter = verification.authenticationInfo.newCounter;
        } catch (verifyError) {
          // Log the error for debugging
          console.error('WebAuthn verification error:', verifyError);
          res.status(401).json({
            error: 'Authentication verification failed',
          });
          return;
        }

        // Record successful authentication - updates counter and lastUsedAt
        await deps.credentialRepository.recordAuthentication(storedCredential.id, newCounter);

        // Get user info from database if userRepository is available
        let userName = 'User';
        let userId: number | undefined;
        if (deps.userRepository) {
          const user = await deps.userRepository.findById(storedCredential.userId);
          if (user) {
            userName = user.name || user.email;
            userId = user.id;
          }
        }

        // Create database session if sessionRepository is available
        if (deps.sessionRepository && userId) {
          const session = await createSession(res, deps.sessionRepository, userId);
          if (!session) {
            res.status(500).json({
              error: 'Failed to create session',
            });
            return;
          }

          res.status(200).json({
            verified: true,
            user: { id: userId, name: userName },
          });
        } else {
          // Fall back to legacy session
          const sessionId = getLegacySessionId(req);
          legacySessions[sessionId].authenticated = true;
          legacySessions[sessionId].user = { id: userId, name: userName };
          delete legacySessions[sessionId].challenge;

          res.status(200).json({
            verified: true,
            user: legacySessions[sessionId].user,
          });
        }
      } else {
        // Mock mode: No credential repository, accept any valid structure
        // This allows testing the WebAuthn flow before credential storage is set up
        try {
          await verifyAuthenticationResponse({
            response: authResponse,
            expectedChallenge: challenge,
            expectedOrigin: EXPECTED_ORIGIN,
            expectedRPID: RP_ID,
            requireUserVerification: false,
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
          console.log('Mock mode: Accepting credential without full verification');
        }

        // Mark legacy session as authenticated (mock user)
        const sessionId = getLegacySessionId(req);
        legacySessions[sessionId].authenticated = true;
        legacySessions[sessionId].user = { name: 'Demo User' };
        delete legacySessions[sessionId].challenge;

        res.status(200).json({
          verified: true,
          user: legacySessions[sessionId].user,
        });
      }
    } catch (error) {
      console.error('Error verifying authentication:', error);
      res.status(500).json({
        error: 'Authentication verification failed',
      });
    }
  };
}

/**
 * Create logout handler with optional dependencies
 * Clears database session if available, otherwise clears legacy session
 */
function createLogoutHandler(deps: AuthDependencies) {
  return async function logout(req: Request, res: Response): Promise<void> {
    try {
      // Try database session first
      if (deps.sessionRepository) {
        await destroySession(req, res, deps.sessionRepository);
        res.status(200).json({
          success: true,
          message: 'Logged out successfully',
        });
        return;
      }

      // Fall back to legacy session
      const sessionId = getLegacySessionId(req);
      legacySessions[sessionId].authenticated = false;
      legacySessions[sessionId].user = null;
      delete legacySessions[sessionId].challenge;

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
  };
}

/**
 * Create checkSession handler with optional dependencies
 * Checks database session if available, otherwise checks legacy session
 */
function createCheckSessionHandler(deps: AuthDependencies) {
  return async function checkSession(req: Request, res: Response): Promise<void> {
    try {
      // Try database session first
      if (deps.sessionRepository && deps.userRepository) {
        const token = req.cookies?.[SESSION_COOKIE_NAME];

        if (!token) {
          res.status(200).json({
            authenticated: false,
            user: null,
          });
          return;
        }

        const session = await deps.sessionRepository.getValidSessionByToken(token);

        if (!session) {
          res.status(200).json({
            authenticated: false,
            user: null,
          });
          return;
        }

        const user = await deps.userRepository.findById(session.userId);

        if (!user) {
          res.status(200).json({
            authenticated: false,
            user: null,
          });
          return;
        }

        // Touch session to update lastAccessedAt (fire-and-forget)
        deps.sessionRepository.touchSession(session.id).catch(() => {});

        res.status(200).json({
          authenticated: true,
          user: { id: user.id, name: user.name || user.email, email: user.email },
        });
        return;
      }

      // Fall back to legacy session
      const sessionId = getLegacySessionId(req);
      const session = legacySessions[sessionId];

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
  };
}

/**
 * Create validateRegistrationToken handler
 * Validates a magic link token and returns the associated email
 * Used to pre-populate the registration form without consuming the token
 */
function createValidateRegistrationTokenHandler(deps: AuthDependencies) {
  return async function validateRegistrationToken(req: Request, res: Response): Promise<void> {
    try {
      // Check if registration is available
      if (!deps.magicLinkService) {
        res.status(501).json({
          error: 'Registration is not available',
        });
        return;
      }

      const { token } = req.query;

      // Validate token parameter
      if (!token || typeof token !== 'string') {
        res.status(400).json({
          error: 'Token is required',
        });
        return;
      }

      // Peek at the token to validate without consuming
      try {
        const email = await deps.magicLinkService.peek(token);

        res.status(200).json({
          valid: true,
          email: email,
        });
      } catch {
        res.status(400).json({
          error: 'Invalid or expired magic link',
        });
      }
    } catch (error) {
      console.error('Error validating registration token:', error);
      res.status(500).json({
        error: 'Failed to validate token',
      });
    }
  };
}

/**
 * Create registration options handler
 * Generates WebAuthn registration options for passkey creation during signup
 */
function createRegistrationOptionsHandler(deps: AuthDependencies) {
  return async function getRegistrationOptions(req: Request, res: Response): Promise<void> {
    try {
      // Check if registration is available
      if (!deps.magicLinkService) {
        res.status(501).json({
          error: 'Registration is not available',
        });
        return;
      }

      const { token } = req.query;

      // Validate token parameter
      if (!token || typeof token !== 'string') {
        res.status(400).json({
          error: 'Token is required',
        });
        return;
      }

      // Peek at the token to get email
      let email: string;
      try {
        email = await deps.magicLinkService.peek(token);
      } catch {
        res.status(400).json({
          error: 'Invalid or expired magic link',
        });
        return;
      }

      // Generate a random user ID for WebAuthn (this will be the user handle)
      // We use the email hash as a consistent identifier
      const userIdBuffer = Buffer.from(email);
      const userId = userIdBuffer.toString('base64url');

      // Generate a challenge for the registration
      const crypto = await import('crypto');
      const challengeBuffer = crypto.randomBytes(32);
      const challenge = challengeBuffer.toString('base64url');

      // Store challenge for later verification
      challenges[challenge] = {
        challenge: challenge,
        createdAt: Date.now(),
      };

      // Return WebAuthn registration options
      res.status(200).json({
        challenge: challenge,
        rp: {
          name: RP_NAME,
          id: RP_ID,
        },
        user: {
          id: userId,
          name: email,
          displayName: email.split('@')[0],
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: 60000,
        attestation: 'none',
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
      });
    } catch (error) {
      console.error('Error generating registration options:', error);
      res.status(500).json({
        error: 'Failed to generate registration options',
      });
    }
  };
}

/**
 * Create register handler
 * Completes user registration with passkey credential
 *
 * Flow:
 * 1. Validate magic link token (marks as used)
 * 2. Check if user already exists with that email
 * 3. Create new user with provided name
 * 4. Store passkey credential
 * 5. Create session (auto-login)
 */
function createRegisterHandler(deps: AuthDependencies) {
  return async function register(req: Request, res: Response): Promise<void> {
    try {
      // Check if registration is available
      if (!deps.magicLinkService) {
        res.status(501).json({
          error: 'Registration is not available',
        });
        return;
      }

      if (!deps.userRepository) {
        res.status(501).json({
          error: 'Registration is not available - user storage not configured',
        });
        return;
      }

      if (!deps.credentialRepository) {
        res.status(501).json({
          error: 'Registration is not available - credential storage not configured',
        });
        return;
      }

      const { token, name, credential } = req.body;

      // Validate required fields
      if (!token || typeof token !== 'string') {
        res.status(400).json({
          error: 'Token is required',
        });
        return;
      }

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({
          error: 'Name is required',
        });
        return;
      }

      if (!credential) {
        res.status(400).json({
          error: 'Credential is required',
        });
        return;
      }

      // Validate credential structure
      if (!credential.id || !credential.rawId || !credential.response || !credential.type) {
        res.status(400).json({
          error: 'Invalid credential format',
        });
        return;
      }

      // Validate and consume the magic link token
      let email: string;
      try {
        email = await deps.magicLinkService.validate(token);
      } catch {
        res.status(400).json({
          error: 'Invalid or expired magic link',
        });
        return;
      }

      // Check if user already exists with this email
      const existingUser = await deps.userRepository.findByEmail(email);
      if (existingUser) {
        res.status(409).json({
          error: 'User already exists with this email',
        });
        return;
      }

      // Get the challenge from the credential's clientDataJSON to find stored challenge
      // The challenge in clientDataJSON is what was sent to the browser
      let storedChallenge: string | undefined;
      try {
        const clientDataBuffer = Buffer.from(credential.response.clientDataJSON, 'base64url');
        const clientData = JSON.parse(clientDataBuffer.toString('utf-8'));
        storedChallenge = clientData.challenge;
      } catch {
        res.status(400).json({
          error: 'Invalid credential: could not parse clientDataJSON',
        });
        return;
      }

      // Verify the challenge exists and is valid
      if (!storedChallenge || !challenges[storedChallenge]) {
        res.status(400).json({
          error: 'Invalid or expired registration challenge',
        });
        return;
      }

      // Verify the registration response
      let registrationInfo;
      try {
        const verification = await verifyRegistrationResponse({
          response: credential,
          expectedChallenge: storedChallenge,
          expectedOrigin: EXPECTED_ORIGIN,
          expectedRPID: RP_ID,
          requireUserVerification: false,
        });

        if (!verification.verified || !verification.registrationInfo) {
          res.status(400).json({
            error: 'Registration verification failed',
          });
          return;
        }

        registrationInfo = verification.registrationInfo;

        // Remove used challenge
        delete challenges[storedChallenge];
      } catch (verifyError) {
        console.error('Registration verification error:', verifyError);
        res.status(400).json({
          error: 'Registration verification failed',
        });
        return;
      }

      // Create new user
      const newUser = await deps.userRepository.createUser({
        email,
        name: name.trim(),
      });

      if (!newUser) {
        res.status(500).json({
          error: 'Failed to create user',
        });
        return;
      }

      // Extract credential info from verified registration
      // In @simplewebauthn/server v13, the credential is nested under registrationInfo.credential
      const { credential: verifiedCredential } = registrationInfo;
      const publicKeyBase64 = Buffer.from(verifiedCredential.publicKey).toString('base64');

      // Store the passkey credential
      // credential.id is already a base64url string
      const savedCredential = await deps.credentialRepository.save({
        userId: newUser.id,
        credentialId: verifiedCredential.id,
        publicKey: publicKeyBase64,
        counter: verifiedCredential.counter,
        deviceType: credential.authenticatorAttachment || 'platform',
        name: 'Registration Passkey',
        createdAt: new Date(),
        lastUsedAt: null,
      });

      if (!savedCredential) {
        // Rollback: delete the user since credential storage failed
        await deps.userRepository.delete(newUser.id);
        res.status(500).json({
          error: 'Failed to store credential',
        });
        return;
      }

      // Create session for automatic login
      if (deps.sessionRepository) {
        const session = await createSession(res, deps.sessionRepository, newUser.id);
        if (!session) {
          res.status(500).json({
            error: 'Failed to create session',
          });
          return;
        }
      }

      res.status(201).json({
        success: true,
        authenticated: true,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      });
    } catch (error) {
      console.error('Error during registration:', error);
      res.status(500).json({
        error: 'Registration failed',
      });
    }
  };
}

/**
 * Create and configure authentication router
 *
 * @param deps - Optional dependencies for real credential verification and database sessions
 * @returns Express router with authentication routes
 *
 * @example
 * // With real verification and database sessions
 * const authRouter = createAuthRouter({
 *   credentialRepository: credentialRepo,
 *   userRepository: userRepo,
 *   sessionRepository: sessionRepo,
 *   magicLinkService: magicLinkService,
 * });
 *
 * @example
 * // Mock mode (no database)
 * const authRouter = createAuthRouter();
 */
export function createAuthRouter(deps: AuthDependencies = {}): Router {
  const router = Router();

  // Add cookie parser for session token reading
  router.use(cookieParser());

  // Login routes
  router.post('/login/start', createStartLoginHandler(deps));
  router.post('/login/verify', createVerifyLoginHandler(deps));
  router.post('/logout', createLogoutHandler(deps));
  router.get('/session', createCheckSessionHandler(deps));

  // Registration routes
  router.get('/register/validate', createValidateRegistrationTokenHandler(deps));
  router.get('/register/options', createRegistrationOptionsHandler(deps));
  router.post('/register', createRegisterHandler(deps));

  return router;
}
