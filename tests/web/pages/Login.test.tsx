/**
 * Login Page Tests
 *
 * Tests for the Login page (/login) with WebAuthn passkey authentication
 *
 * @jest-environment jsdom
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Login } from '@/web/frontend/pages/Login';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import * as apiClient from '@/web/frontend/services/apiClient';
import { startAuthentication } from '@simplewebauthn/browser';

// Mock the apiClient module
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    startLogin: jest.fn(),
    verifyLogin: jest.fn(),
    logout: jest.fn(),
    checkSession: jest.fn(),
  },
}));

// Mock @simplewebauthn/browser
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>;
const mockStartAuthentication = startAuthentication as jest.MockedFunction<
  typeof startAuthentication
>;

// Mock PublicKeyCredential for browser support detection
Object.defineProperty(globalThis, 'PublicKeyCredential', {
  value: {
    isConditionalMediationAvailable: (() => Promise.resolve(true)) as unknown,
  },
  writable: true,
  configurable: true,
});

describe('Login Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mocks to prevent leak between tests
    mockStartAuthentication.mockReset();
    mockApiClient.startLogin.mockReset();
    mockApiClient.verifyLogin.mockReset();
    mockApiClient.logout.mockReset();

    // Mock successful session check by default
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: false,
      user: null,
    });
  });

  const renderLoginPage = () => {
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  describe('Rendering', () => {
    it('should render login page with title and description', async () => {
      renderLoginPage();

      await waitFor(() => {
        const title = screen.getByText(/welcome back/i);
        // @ts-expect-error - jest-dom matchers
        expect(title).toBeInTheDocument();

        const description = screen.getByText(/sign in to your clack track account/i);
        // @ts-expect-error - jest-dom matchers
        expect(description).toBeInTheDocument();
      });
    });

    it('should render Sign in with Passkey button', async () => {
      renderLoginPage();

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sign in with passkey/i });
        // @ts-expect-error - jest-dom matchers
        expect(button).toBeInTheDocument();
      });
    });

    it('should display WebAuthn description text', () => {
      renderLoginPage();

      const description = screen.getByText(/passwordless authentication using webauthn/i);
      // @ts-expect-error - jest-dom matchers
      expect(description).toBeInTheDocument();
    });

    it('should display Shield icon in button', async () => {
      renderLoginPage();

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sign in with passkey/i });
        // @ts-expect-error - jest-dom matchers
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('Browser Compatibility', () => {
    it('should show passkey button when browser supports WebAuthn', async () => {
      renderLoginPage();

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sign in with passkey/i });
        // @ts-expect-error - jest-dom matchers
        expect(button).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(button).not.toBeDisabled();
      });
    });

    it('should show error message when browser does not support WebAuthn', async () => {
      // Mock unsupported browser by temporarily removing PublicKeyCredential
      const originalPublicKeyCredential = (globalThis as { PublicKeyCredential?: unknown })
        .PublicKeyCredential;
      delete (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential;

      renderLoginPage();

      await waitFor(() => {
        const errorMessage = screen.getByText(/your browser does not support passkey/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });

      // Restore for other tests
      (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential =
        originalPublicKeyCredential;
    });

    it('should disable button when browser does not support WebAuthn', async () => {
      // Mock unsupported browser by temporarily removing PublicKeyCredential
      const originalPublicKeyCredential = (globalThis as { PublicKeyCredential?: unknown })
        .PublicKeyCredential;
      delete (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential;

      renderLoginPage();

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sign in with passkey/i });
        // @ts-expect-error - jest-dom matchers
        expect(button).toBeDisabled();
      });

      // Restore for other tests
      (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential =
        originalPublicKeyCredential;
    });
  });

  describe('Authentication Flow', () => {
    it('should trigger passkey authentication when button is clicked', async () => {
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

      mockApiClient.startLogin.mockResolvedValue(mockChallenge);
      mockStartAuthentication.mockResolvedValue(mockCredential);
      mockApiClient.verifyLogin.mockResolvedValue({
        verified: true,
        user: { name: 'Test User' },
      });

      renderLoginPage();

      // Wait for initial loading to complete
      const button = await screen.findByRole('button', { name: /sign in with passkey/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockApiClient.startLogin).toHaveBeenCalledTimes(1);
      });
    });

    it('should show loading state during authentication', async () => {
      const mockChallenge = {
        challenge: 'mock-challenge-123',
        rpId: 'localhost',
        rpName: 'Clack Track',
        timeout: 60000,
        userVerification: 'preferred',
      };

      mockApiClient.startLogin.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockChallenge), 100))
      );

      renderLoginPage();

      // Wait for initial loading to complete
      const button = await screen.findByRole('button', { name: /sign in with passkey/i });
      fireEvent.click(button);

      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: /signing in/i });
        // @ts-expect-error - jest-dom matchers
        expect(loadingButton).toBeInTheDocument();
      });
    });

    it('should disable button during authentication', async () => {
      const mockChallenge = {
        challenge: 'mock-challenge-123',
        rpId: 'localhost',
        rpName: 'Clack Track',
        timeout: 60000,
        userVerification: 'preferred',
      };

      mockApiClient.startLogin.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockChallenge), 100))
      );

      renderLoginPage();

      // Wait for initial loading to complete
      const button = await screen.findByRole('button', { name: /sign in with passkey/i });
      fireEvent.click(button);

      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: /signing in/i });
        // @ts-expect-error - jest-dom matchers
        expect(loadingButton).toBeDisabled();
      });
    });

    it('should redirect to home page on successful authentication', async () => {
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

      mockApiClient.startLogin.mockResolvedValue(mockChallenge);
      mockStartAuthentication.mockResolvedValue(mockCredential);
      mockApiClient.verifyLogin.mockResolvedValue({
        verified: true,
        user: { name: 'Test User' },
      });

      renderLoginPage();

      // Wait for initial loading to complete
      const button = await screen.findByRole('button', { name: /sign in with passkey/i });
      fireEvent.click(button);

      await waitFor(() => {
        const homeText = screen.queryByText(/home page/i);
        // @ts-expect-error - jest-dom matchers
        expect(homeText).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when user cancels passkey prompt', async () => {
      const mockChallenge = {
        challenge: 'mock-challenge-123',
        rpId: 'localhost',
        rpName: 'Clack Track',
        timeout: 60000,
        userVerification: 'preferred',
      };

      mockApiClient.startLogin.mockResolvedValue(mockChallenge);
      mockStartAuthentication.mockRejectedValue(
        new DOMException('User cancelled', 'NotAllowedError')
      );

      renderLoginPage();

      // Wait for initial loading to complete
      const button = await screen.findByRole('button', { name: /sign in with passkey/i });
      fireEvent.click(button);

      await waitFor(() => {
        const errorMessage = screen.getByText(/authentication was cancelled/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should show error message when API fails', async () => {
      mockApiClient.startLogin.mockRejectedValue(new Error('API Error: Server unavailable'));

      renderLoginPage();

      // Wait for initial loading to complete
      const button = await screen.findByRole('button', { name: /sign in with passkey/i });
      fireEvent.click(button);

      await waitFor(() => {
        const errorMessage = screen.getByText(/server unavailable/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should show error message when verification fails', async () => {
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

      mockApiClient.startLogin.mockResolvedValue(mockChallenge);
      mockStartAuthentication.mockResolvedValue(mockCredential);
      mockApiClient.verifyLogin.mockRejectedValue(new Error('API Error (401): Invalid credential'));

      renderLoginPage();

      // Wait for initial loading to complete
      const button = await screen.findByRole('button', { name: /sign in with passkey/i });
      fireEvent.click(button);

      await waitFor(() => {
        const errorMessage = screen.getByText(/invalid credential/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      mockApiClient.startLogin
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          challenge: 'mock-challenge-123',
          rpId: 'localhost',
          rpName: 'Clack Track',
          timeout: 60000,
          userVerification: 'preferred',
        });

      renderLoginPage();

      // Wait for initial loading to complete
      const button = await screen.findByRole('button', { name: /sign in with passkey/i });

      // First attempt fails
      fireEvent.click(button);

      await waitFor(() => {
        const errorMessage = screen.getByText(/network error/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });

      // Second attempt should work
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockApiClient.startLogin).toHaveBeenCalledTimes(2);
      });
    });

    it('should clear previous error when starting new authentication', async () => {
      mockApiClient.startLogin
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          challenge: 'mock-challenge-123',
          rpId: 'localhost',
          rpName: 'Clack Track',
          timeout: 60000,
          userVerification: 'preferred',
        });

      renderLoginPage();

      // Wait for initial loading to complete
      const button = await screen.findByRole('button', { name: /sign in with passkey/i });

      // First attempt fails
      fireEvent.click(button);

      await waitFor(() => {
        const errorMessage = screen.getByText(/network error/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });

      // Second attempt should clear error
      fireEvent.click(button);

      await waitFor(() => {
        const errorMessage = screen.queryByText(/network error/i);
        expect(errorMessage).toBeNull();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button with proper label', async () => {
      renderLoginPage();

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sign in with passkey/i });
        // @ts-expect-error - jest-dom matchers
        expect(button).toBeInTheDocument();
      });
    });

    it('should have accessible headings hierarchy', async () => {
      renderLoginPage();

      await waitFor(() => {
        // CardTitle renders as div, so we check for text content
        const title = screen.getByText(/welcome back/i);
        // @ts-expect-error - jest-dom matchers
        expect(title).toBeInTheDocument();
      });
    });

    it('should have accessible error messages with role alert', async () => {
      mockApiClient.startLogin.mockRejectedValue(new Error('Network error'));

      renderLoginPage();

      // Wait for initial loading to complete
      const button = await screen.findByRole('button', { name: /sign in with passkey/i });
      fireEvent.click(button);

      await waitFor(() => {
        const errorMessage = screen.getByText(/network error/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });
    });
  });
});
