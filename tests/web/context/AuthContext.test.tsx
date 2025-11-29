/**
 * AuthContext Tests
 *
 * Tests authentication context provider and hooks:
 * - Authentication state management
 * - Login/logout functionality
 * - Loading states
 * - Session persistence
 *
 * @jest-environment jsdom
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../../src/web/frontend/context/AuthContext.js';
import * as apiClient from '../../../src/web/frontend/services/apiClient.js';
import { startAuthentication } from '@simplewebauthn/browser';

// Mock the API client
jest.mock('../../../src/web/frontend/services/apiClient.js');

// Mock @simplewebauthn/browser
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful session check by default
    (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
      authenticated: false,
      user: null,
    });

    // Reset startAuthentication mock to prevent leak between tests
    (startAuthentication as jest.Mock).mockReset();
    (apiClient.apiClient.verifyLogin as jest.Mock).mockReset();
    (apiClient.apiClient.startLogin as jest.Mock).mockReset();
  });

  describe('Initial State', () => {
    it('should start with unauthenticated state', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should check session on mount', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(apiClient.apiClient.checkSession).toHaveBeenCalledTimes(1);
      });
    });

    it('should restore authenticated session on mount', async () => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual({ name: 'Test User' });
    });
  });

  describe('Login', () => {
    it('should successfully login with passkey', async () => {
      const mockChallenge = {
        challenge: 'mock-challenge-123',
        rpId: 'localhost',
        rpName: 'Clack Track',
        timeout: 60000,
        userVerification: 'preferred',
      };

      const mockCredential = {
        id: 'mock-credential-id',
        rawId: new ArrayBuffer(16),
        response: {
          clientDataJSON: new ArrayBuffer(32),
          authenticatorData: new ArrayBuffer(64),
          signature: new ArrayBuffer(64),
          userHandle: new ArrayBuffer(16),
        },
        type: 'public-key' as const,
      };

      (apiClient.apiClient.startLogin as jest.Mock).mockResolvedValue(mockChallenge);
      (startAuthentication as jest.Mock).mockResolvedValue(mockCredential);
      (apiClient.apiClient.verifyLogin as jest.Mock).mockResolvedValue({
        verified: true,
        user: { name: 'Test User' },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login();
      });

      expect(apiClient.apiClient.startLogin).toHaveBeenCalledTimes(1);
      expect(apiClient.apiClient.verifyLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: expect.any(Object),
          challenge: mockChallenge.challenge,
        })
      );

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual({ name: 'Test User' });
    });

    it('should handle user cancelling passkey prompt', async () => {
      const mockChallenge = {
        challenge: 'mock-challenge-123',
        rpId: 'localhost',
        rpName: 'Clack Track',
        timeout: 60000,
        userVerification: 'preferred',
      };

      (apiClient.apiClient.startLogin as jest.Mock).mockResolvedValue(mockChallenge);
      (startAuthentication as jest.Mock).mockRejectedValue(
        new DOMException('User cancelled', 'NotAllowedError')
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await expect(result.current.login()).rejects.toThrow('User cancelled');
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should handle API errors during login start', async () => {
      (apiClient.apiClient.startLogin as jest.Mock).mockRejectedValue(
        new Error('API Error: Server unavailable')
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await expect(result.current.login()).rejects.toThrow('API Error: Server unavailable');
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle verification failure', async () => {
      const mockChallenge = {
        challenge: 'mock-challenge-123',
        rpId: 'localhost',
        rpName: 'Clack Track',
        timeout: 60000,
        userVerification: 'preferred',
      };

      const mockCredential = {
        id: 'mock-credential-id',
        rawId: new ArrayBuffer(16),
        response: {
          clientDataJSON: new ArrayBuffer(32),
          authenticatorData: new ArrayBuffer(64),
          signature: new ArrayBuffer(64),
          userHandle: new ArrayBuffer(16),
        },
        type: 'public-key' as const,
      };

      (apiClient.apiClient.startLogin as jest.Mock).mockResolvedValue(mockChallenge);
      (startAuthentication as jest.Mock).mockResolvedValue(mockCredential);
      (apiClient.apiClient.verifyLogin as jest.Mock).mockRejectedValue(
        new Error('API Error (401): Invalid credential')
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await expect(result.current.login()).rejects.toThrow('Invalid credential');
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should set loading state during login', async () => {
      const mockChallenge = {
        challenge: 'mock-challenge-123',
        rpId: 'localhost',
        rpName: 'Clack Track',
        timeout: 60000,
        userVerification: 'preferred',
      };

      const mockCredential = {
        id: 'mock-credential-id',
        rawId: 'mock-raw-id',
        response: {
          clientDataJSON: 'mock-client-data',
          authenticatorData: 'mock-auth-data',
          signature: 'mock-signature',
          userHandle: 'mock-user-handle',
        },
        type: 'public-key' as const,
        clientExtensionResults: {},
        authenticatorAttachment: 'platform' as const,
      };

      (apiClient.apiClient.startLogin as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockChallenge), 100))
      );
      (startAuthentication as jest.Mock).mockResolvedValue(mockCredential);
      (apiClient.apiClient.verifyLogin as jest.Mock).mockResolvedValue({
        verified: true,
        user: { name: 'Test User' },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let loginPromise: Promise<void>;
      act(() => {
        loginPromise = result.current.login();
      });

      // Should be loading during the API call
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await loginPromise;
      });
    });
  });

  describe('Logout', () => {
    it('should successfully logout authenticated user', async () => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      (apiClient.apiClient.logout as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(apiClient.apiClient.logout).toHaveBeenCalledTimes(1);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should handle logout errors gracefully', async () => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      (apiClient.apiClient.logout as jest.Mock).mockRejectedValue(new Error('Network error'));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await expect(result.current.logout()).rejects.toThrow('Network error');
      });

      // State should remain authenticated on logout failure
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should set loading state during logout', async () => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      (apiClient.apiClient.logout as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      let logoutPromise: Promise<void>;
      act(() => {
        logoutPromise = result.current.logout();
      });

      // Should be loading during the API call
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await logoutPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });
  });
});
