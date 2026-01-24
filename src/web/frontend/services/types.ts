/**
 * API Client Type Definitions
 *
 * Type-safe interfaces for all API requests and responses
 */

import type { ContentRecord } from '../../../storage/models/content.js';
import type { VoteRecord } from '../../../storage/models/vote.js';
import type { LogRecord, LogLevel } from '../../../storage/models/log.js';

/**
 * Base API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    limit: number;
    count: number;
  };
}

/**
 * Content API Responses
 *
 * Backend sends data directly (not wrapped):
 * - /api/content/latest returns { success: true, data: ContentRecord | null }
 * - /api/content/history returns { success: true, data: ContentRecord[], pagination: {...} }
 */

/**
 * Extended ContentRecord with optional characterCodes from frame decoration
 *
 * The /api/content/latest endpoint adds characterCodes to the response:
 * - For outputMode='text' or null (legacy): Generated via frame decoration
 * - For outputMode='layout': Extracted from metadata.characterCodes
 */
export interface ContentWithCharacterCodes extends ContentRecord {
  /** 6x22 character codes grid for Vestaboard display */
  characterCodes?: number[][];
}

export type LatestContentResponse = ContentWithCharacterCodes | null;

export interface ContentHistoryParams {
  limit?: number;
  type?: 'major' | 'minor';
}

export type ContentHistoryResponse = ContentRecord[];

/**
 * Voting API Types
 */
export interface VoteSubmission {
  contentId: string;
  vote: 'good' | 'bad';
}

export interface VoteResponse {
  vote: VoteRecord;
}

/**
 * Logs API Types
 */
export interface LogFilters {
  level?: LogLevel;
  limit?: number;
}

export interface LogsResponse {
  logs: LogRecord[];
  total: number;
}

/**
 * Authentication API Types
 */
export interface AuthenticationOptions {
  challenge: string;
  rpId: string;
  rpName: string;
  timeout: number;
  userVerification: string;
}

export interface AuthCredential {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
  type: 'public-key';
}

export interface VerifyLoginRequest {
  credential: AuthCredential;
  challenge: string;
}

export interface VerifyLoginResponse {
  verified: boolean;
  user: { name: string };
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user: { name: string } | null;
}

/**
 * Account API Types
 */
export interface ProfileResponse {
  username: string;
  email: string;
  createdAt: string;
}

export interface Passkey {
  id: string;
  name: string;
  deviceType: 'phone' | 'tablet' | 'laptop' | 'desktop' | 'security-key';
  createdAt: string;
  lastUsed: string;
}

export interface PasskeysResponse {
  passkeys: Passkey[];
}

export interface RegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;
  }>;
  timeout: number;
  attestation?: string;
  authenticatorSelection?: {
    residentKey?: string;
    userVerification?: string;
  };
}

export interface RegistrationCredential {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
  };
  type: 'public-key';
}

export interface VerifyRegistrationRequest {
  credential: RegistrationCredential;
  name: string;
}

export interface VerifyRegistrationResponse {
  verified: boolean;
  passkey: Passkey;
}

export interface RemovePasskeyResponse {
  success: boolean;
}

export interface RenamePasskeyResponse {
  passkey: Passkey;
}

/**
 * Push Notification Types
 */
export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export type PushPermission = 'granted' | 'denied' | 'default';

/**
 * Configuration API Types
 */
export interface VestaboardConfigResponse {
  model: 'black' | 'white';
}

/**
 * Circuit Breaker API Types
 */
export interface CircuitData {
  id: string;
  name: string;
  description?: string;
  type: 'manual' | 'provider';
  state: 'on' | 'off' | 'half_open';
  failureCount?: number;
  failureThreshold?: number;
}

export type CircuitsResponse = CircuitData[];

export interface CircuitActionResponse {
  success: boolean;
  message?: string;
}

/**
 * Error response types
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
