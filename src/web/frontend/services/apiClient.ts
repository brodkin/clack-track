/**
 * API Client Service
 *
 * Type-safe HTTP client for all backend API endpoints.
 * Provides methods for content, voting, and logs operations.
 *
 * Architecture:
 * - Single Responsibility: Each method handles one API endpoint
 * - Open/Closed: Extensible via new methods without modifying existing ones
 * - Dependency Inversion: Depends on fetch abstraction, not concrete implementation
 */

import type {
  ApiResponse,
  LatestContentResponse,
  ContentHistoryParams,
  ContentHistoryResponse,
  VoteSubmission,
  VoteResponse,
  LogFilters,
  LogsResponse,
  AuthenticationOptions,
  VerifyLoginRequest,
  VerifyLoginResponse,
  LogoutResponse,
  SessionResponse,
  ProfileResponse,
  PasskeysResponse,
  RegistrationOptions,
  VerifyRegistrationRequest,
  VerifyRegistrationResponse,
  RemovePasskeyResponse,
  RenamePasskeyResponse,
  VestaboardConfigResponse,
  CircuitsResponse,
  CircuitActionResponse,
  GenerateInviteResponse,
  ValidateRegistrationTokenResponse,
  CompleteRegistrationRequest,
  CompleteRegistrationResponse,
} from './types.js';

/**
 * Base URL for API requests
 * In production, this would be configurable via environment or dependency injection
 */
const API_BASE_URL = '';

/**
 * HTTP client configuration
 */
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
} as const;

/**
 * Error handling utility
 * Extracts error message from API response or falls back to status text
 */
function extractErrorMessage(data: { error?: string }, statusText: string): string {
  return data.error || statusText;
}

/**
 * HTTP response handler
 * Validates response and extracts JSON data with proper error handling
 */
async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data = (await response.json()) as { error?: string };

  if (!response.ok) {
    const errorMessage = extractErrorMessage(data, response.statusText);
    throw new Error(`API Error (${response.status}): ${errorMessage}`);
  }

  return data as ApiResponse<T>;
}

/**
 * Fetch wrapper with error handling and type safety
 * Single Responsibility: Handles HTTP request/response cycle
 */
async function fetchJSON<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...options?.headers,
    },
  });

  return handleResponse<T>(response);
}

/**
 * Query string builder
 * Converts parameter object to URL query string
 */
function buildQueryString(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

/**
 * URL builder with query parameters
 * Single Responsibility: Constructs URLs with optional query strings
 */
function buildURL(path: string, params?: Record<string, string | number | undefined>): string {
  if (!params || Object.keys(params).length === 0) {
    return path;
  }

  const queryString = buildQueryString(params);
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * API Client
 *
 * Provides type-safe methods for all API endpoints
 */
export const apiClient = {
  /**
   * Get the latest content sent to Vestaboard
   */
  async getLatestContent(): Promise<ApiResponse<LatestContentResponse>> {
    return fetchJSON<LatestContentResponse>(`${API_BASE_URL}/api/content/latest`, {
      method: 'GET',
    });
  },

  /**
   * Get content history with optional filtering
   */
  async getContentHistory(
    params?: ContentHistoryParams
  ): Promise<ApiResponse<ContentHistoryResponse>> {
    const url = buildURL(
      `${API_BASE_URL}/api/content/history`,
      params as Record<string, string | number | undefined>
    );
    return fetchJSON<ContentHistoryResponse>(url, {
      method: 'GET',
    });
  },

  /**
   * Submit a vote for content (good or bad)
   */
  async submitVote(vote: VoteSubmission): Promise<ApiResponse<VoteResponse>> {
    return fetchJSON<VoteResponse>(`${API_BASE_URL}/api/vote`, {
      method: 'POST',
      body: JSON.stringify(vote),
    });
  },

  /**
   * Get debug logs with optional filtering
   */
  async getLogs(filters?: LogFilters): Promise<ApiResponse<LogsResponse>> {
    const url = buildURL(
      `${API_BASE_URL}/api/logs`,
      filters as Record<string, string | number | undefined>
    );
    return fetchJSON<LogsResponse>(url, {
      method: 'GET',
    });
  },

  /**
   * Start passkey login flow - get authentication challenge
   */
  async startLogin(): Promise<AuthenticationOptions> {
    const response = await fetchJSON<AuthenticationOptions>(
      `${API_BASE_URL}/api/auth/login/start`,
      {
        method: 'POST',
      }
    );
    return response as unknown as AuthenticationOptions;
  },

  /**
   * Verify passkey authentication response
   */
  async verifyLogin(request: VerifyLoginRequest): Promise<VerifyLoginResponse> {
    const response = await fetchJSON<VerifyLoginResponse>(`${API_BASE_URL}/api/auth/login/verify`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response as unknown as VerifyLoginResponse;
  },

  /**
   * Logout current user
   */
  async logout(): Promise<LogoutResponse> {
    const response = await fetchJSON<LogoutResponse>(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
    });
    return response as unknown as LogoutResponse;
  },

  /**
   * Check current authentication session
   */
  async checkSession(): Promise<SessionResponse> {
    const response = await fetchJSON<SessionResponse>(`${API_BASE_URL}/api/auth/session`, {
      method: 'GET',
    });
    return response as unknown as SessionResponse;
  },

  /**
   * Get user profile information
   */
  async getProfile(): Promise<ProfileResponse> {
    const response = await fetchJSON<ProfileResponse>(`${API_BASE_URL}/api/account/profile`, {
      method: 'GET',
    });
    return response as unknown as ProfileResponse;
  },

  /**
   * Get list of passkeys for authenticated user
   */
  async getPasskeys(): Promise<PasskeysResponse> {
    const response = await fetchJSON<PasskeysResponse>(`${API_BASE_URL}/api/account/passkeys`, {
      method: 'GET',
    });
    return response as unknown as PasskeysResponse;
  },

  /**
   * Start passkey registration flow - get registration challenge
   */
  async registerPasskeyStart(): Promise<RegistrationOptions> {
    const response = await fetchJSON<RegistrationOptions>(
      `${API_BASE_URL}/api/account/passkey/register/start`,
      {
        method: 'POST',
      }
    );
    return response as unknown as RegistrationOptions;
  },

  /**
   * Verify passkey registration response and store new passkey
   */
  async registerPasskeyVerify(
    request: VerifyRegistrationRequest
  ): Promise<VerifyRegistrationResponse> {
    const response = await fetchJSON<VerifyRegistrationResponse>(
      `${API_BASE_URL}/api/account/passkey/register/verify`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
    return response as unknown as VerifyRegistrationResponse;
  },

  /**
   * Remove a passkey by ID
   */
  async removePasskey(id: string): Promise<RemovePasskeyResponse> {
    const response = await fetchJSON<RemovePasskeyResponse>(
      `${API_BASE_URL}/api/account/passkey/${id}`,
      {
        method: 'DELETE',
      }
    );
    return response as unknown as RemovePasskeyResponse;
  },

  /**
   * Rename a passkey
   */
  async renamePasskey(id: string, name: string): Promise<RenamePasskeyResponse> {
    const response = await fetchJSON<RenamePasskeyResponse>(
      `${API_BASE_URL}/api/account/passkey/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }
    );
    return response as unknown as RenamePasskeyResponse;
  },

  /**
   * Get Vestaboard configuration (model type)
   */
  async getVestaboardConfig(): Promise<VestaboardConfigResponse> {
    const response = await fetchJSON<VestaboardConfigResponse>(
      `${API_BASE_URL}/api/config/vestaboard`,
      {
        method: 'GET',
      }
    );
    return response as unknown as VestaboardConfigResponse;
  },

  /**
   * Get all circuit breakers
   */
  async getCircuits(): Promise<ApiResponse<CircuitsResponse>> {
    return fetchJSON<CircuitsResponse>(`${API_BASE_URL}/api/circuits`, {
      method: 'GET',
    });
  },

  /**
   * Enable a circuit breaker
   */
  async enableCircuit(id: string): Promise<CircuitActionResponse> {
    const response = await fetchJSON<CircuitActionResponse>(
      `${API_BASE_URL}/api/circuits/${id}/on`,
      {
        method: 'POST',
      }
    );
    return response as unknown as CircuitActionResponse;
  },

  /**
   * Disable a circuit breaker
   */
  async disableCircuit(id: string): Promise<CircuitActionResponse> {
    const response = await fetchJSON<CircuitActionResponse>(
      `${API_BASE_URL}/api/circuits/${id}/off`,
      {
        method: 'POST',
      }
    );
    return response as unknown as CircuitActionResponse;
  },

  /**
   * Reset a provider circuit breaker
   */
  async resetCircuit(id: string): Promise<CircuitActionResponse> {
    const response = await fetchJSON<CircuitActionResponse>(
      `${API_BASE_URL}/api/circuits/${id}/reset`,
      {
        method: 'POST',
      }
    );
    return response as unknown as CircuitActionResponse;
  },

  /**
   * Generate a magic link invite for user registration
   * Requires authentication - only accessible to admin users
   */
  async generateInvite(email: string): Promise<GenerateInviteResponse> {
    const response = await fetchJSON<GenerateInviteResponse>(`${API_BASE_URL}/api/admin/invite`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return response as unknown as GenerateInviteResponse;
  },

  /**
   * Validate a registration token (magic link)
   * Returns the email associated with the token if valid
   */
  async validateRegistrationToken(token: string): Promise<ValidateRegistrationTokenResponse> {
    const response = await fetchJSON<ValidateRegistrationTokenResponse>(
      `${API_BASE_URL}/api/auth/register/validate?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
      }
    );
    return response as unknown as ValidateRegistrationTokenResponse;
  },

  /**
   * Get registration options for passkey creation during signup
   */
  async getRegistrationOptions(token: string): Promise<RegistrationOptions> {
    const response = await fetchJSON<RegistrationOptions>(
      `${API_BASE_URL}/api/auth/register/options?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
      }
    );
    return response as unknown as RegistrationOptions;
  },

  /**
   * Complete user registration with passkey
   */
  async completeRegistration(
    request: CompleteRegistrationRequest
  ): Promise<CompleteRegistrationResponse> {
    const response = await fetchJSON<CompleteRegistrationResponse>(
      `${API_BASE_URL}/api/auth/register`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
    return response as unknown as CompleteRegistrationResponse;
  },
};
