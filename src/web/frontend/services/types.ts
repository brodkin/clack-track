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
}

/**
 * Content API Responses
 */
export interface LatestContentResponse {
  content: ContentRecord | null;
}

export interface ContentHistoryParams {
  limit?: number;
  type?: 'major' | 'minor';
}

export interface ContentHistoryResponse {
  contents: ContentRecord[];
  total: number;
}

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
