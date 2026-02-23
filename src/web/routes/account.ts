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

import { Router, type Request, type Response } from 'express';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/server';
import type { SessionRepository } from '@/storage/repositories/session-repo.js';
import type { UserRepository } from '@/storage/repositories/user-repo.js';
import type { CredentialRepository } from '@/storage/repositories/credential-repo.js';
import { requireAuth } from '../middleware/session.js';
import { config } from '../../config/env.js';

/**
 * Dependencies for account routes
 *
 * All three repositories are required at runtime. The properties are typed as optional
 * to maintain compatibility with WebDependencies (which uses optional fields for
 * graceful degradation). createAccountRouter will throw if any are missing.
 */
export interface AccountDependencies {
  sessionRepository?: SessionRepository;
  userRepository?: UserRepository;
  credentialRepository?: CredentialRepository;
}

/**
 * Internal type with all dependencies guaranteed present.
 * Used by handler factories after createAccountRouter validates deps.
 */
type ValidatedDeps = Required<AccountDependencies>;

/** Relying Party configuration - sourced from centralized config (shared with auth.ts) */
const RP_NAME = config.webauthn.rpName;
const RP_ID = config.webauthn.rpId;
const EXPECTED_ORIGIN = config.webauthn.origin;

/**
 * Challenge storage for passkey registration (keyed by challenge string)
 * Used to verify registration responses
 */
const registrationChallenges: { [challenge: string]: { usedId: number; email: string } } = {};

/**
 * Create and configure account router
 *
 * Requires all three repositories (session, user, credential).
 * Throws if any dependency is missing -- no legacy fallback.
 *
 * @param deps - Dependencies for database-backed sessions
 * @returns Express router with account management routes
 * @throws Error if sessionRepository, userRepository, or credentialRepository is missing
 */
export function createAccountRouter(deps: AccountDependencies = {}): Router {
  if (!deps.sessionRepository || !deps.userRepository || !deps.credentialRepository) {
    throw new Error(
      'Account routes require sessionRepository, userRepository, and credentialRepository'
    );
  }

  // Narrow types for downstream handler factories
  const validatedDeps: ValidatedDeps = {
    sessionRepository: deps.sessionRepository,
    userRepository: deps.userRepository,
    credentialRepository: deps.credentialRepository,
  };

  const router = Router();

  // Database-backed authentication middleware
  router.use(requireAuth(validatedDeps.sessionRepository, validatedDeps.userRepository));

  // Profile routes
  router.get('/profile', createGetProfile(validatedDeps));

  // Passkey management routes
  router.get('/passkeys', createGetPasskeys(validatedDeps));
  router.post('/passkey/register/start', createStartPasskeyRegistration(validatedDeps));
  router.post('/passkey/register/verify', createVerifyPasskeyRegistration(validatedDeps));
  router.delete('/passkey/:id', createRemovePasskey(validatedDeps));
  router.patch('/passkey/:id', createRenamePasskey(validatedDeps));

  return router;
}

/**
 * Create profile handler
 */
function createGetProfile(_deps: ValidatedDeps) {
  return async function getProfileHandler(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as Request & { user?: { id: number; email: string; name?: string } }).user;
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.status(200).json({
        name: user.name || user.email.split('@')[0],
        email: user.email,
        createdAt: new Date().toISOString(), // TODO: Add createdAt to user model
      });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  };
}

/**
 * Create passkeys handler
 */
function createGetPasskeys(deps: ValidatedDeps) {
  return async function getPasskeysHandler(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as Request & { user?: { id: number } }).user;
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

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
    } catch (error) {
      console.error('Error fetching passkeys:', error);
      res.status(500).json({ error: 'Failed to fetch passkeys' });
    }
  };
}

/**
 * Create passkey registration start handler
 */
function createStartPasskeyRegistration(_deps: ValidatedDeps) {
  return async function startPasskeyRegistrationHandler(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = (req as Request & { user?: { id: number; email: string; name?: string } }).user;
      if (!user) {
        res.status(500).json({ error: 'Session data not available' });
        return;
      }

      // Generate registration options
      const options: PublicKeyCredentialCreationOptionsJSON = await generateRegistrationOptions({
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
      });

      // Store challenge for verification (keyed by challenge string)
      registrationChallenges[options.challenge] = { usedId: user.id, email: user.email };

      res.status(200).json(options);
    } catch (error) {
      console.error('Error generating registration options:', error);
      res.status(500).json({ error: 'Failed to start registration' });
    }
  };
}

/**
 * Create passkey registration verify handler
 */
function createVerifyPasskeyRegistration(deps: ValidatedDeps) {
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
    } catch (error) {
      console.error('Error verifying registration:', error);
      res.status(500).json({ error: 'Registration verification failed' });
    }
  };
}

/**
 * Create remove passkey handler
 */
function createRemovePasskey(deps: ValidatedDeps) {
  return async function removePasskeyHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as Request & { user?: { id: number } }).user;
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

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
    } catch (error) {
      console.error('Error removing passkey:', error);
      res.status(500).json({ error: 'Failed to remove passkey' });
    }
  };
}

/**
 * Create rename passkey handler
 */
function createRenamePasskey(deps: ValidatedDeps) {
  return async function renamePasskeyHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Missing required field: name' });
        return;
      }

      const user = (req as Request & { user?: { id: number } }).user;
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

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
    } catch (error) {
      console.error('Error renaming passkey:', error);
      res.status(500).json({ error: 'Failed to rename passkey' });
    }
  };
}
