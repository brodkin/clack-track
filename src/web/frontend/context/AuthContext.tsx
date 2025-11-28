/**
 * Authentication Context
 *
 * Provides authentication state and operations throughout the application.
 * Manages passkey login flow using WebAuthn API.
 *
 * Architecture:
 * - Single Responsibility: Manages only authentication state
 * - Dependency Inversion: Depends on apiClient abstraction
 * - Open/Closed: Extensible via hooks without modifying provider
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { apiClient } from '../services/apiClient.js';
import type { AuthenticationOptions } from '../services/types.js';

/**
 * Authentication context value interface
 */
export interface AuthContextValue {
  isAuthenticated: boolean;
  user: { name: string } | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Authentication context
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Authentication provider props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 *
 * Manages authentication state and provides login/logout operations
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Check session on mount
   */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await apiClient.checkSession();
        setIsAuthenticated(session.authenticated);
        setUser(session.user);
      } catch (error) {
        console.error('Failed to check session:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  /**
   * Login with passkey
   */
  const login = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Step 1: Get authentication options from server
      const options: AuthenticationOptions = await apiClient.startLogin();

      // Step 2: Use options directly - startAuthentication expects string challenge
      const publicKeyOptions = {
        challenge: options.challenge,
        timeout: options.timeout,
        rpId: options.rpId,
        userVerification: options.userVerification as
          | 'required'
          | 'preferred'
          | 'discouraged'
          | undefined,
      };

      // Step 3: Prompt user for passkey authentication
      const credential = await startAuthentication({ optionsJSON: publicKeyOptions });

      // Step 4: Send credential to server for verification
      const result = await apiClient.verifyLogin({
        credential: credential as {
          id: string;
          rawId: string;
          response: {
            clientDataJSON: string;
            authenticatorData: string;
            signature: string;
            userHandle?: string;
          };
          type: 'public-key';
        },
        challenge: options.challenge,
      });

      // Step 5: Update authentication state
      if (result.verified) {
        setIsAuthenticated(true);
        setUser(result.user);
      } else {
        throw new Error('Authentication verification failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout current user
   */
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await apiClient.logout();
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextValue = {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context
 *
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
