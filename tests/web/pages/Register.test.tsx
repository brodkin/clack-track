/**
 * Register Page Tests
 *
 * Tests for the Registration page (/register?token=xxx)
 * - Token validation and UI display
 * - Name input and passkey setup
 * - Error handling for invalid/expired tokens
 *
 * @jest-environment jsdom
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Register } from '@/web/frontend/pages/Register';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import * as apiClient from '@/web/frontend/services/apiClient';
import { startRegistration } from '@simplewebauthn/browser';

// Mock the apiClient module
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    checkSession: jest.fn(),
    validateRegistrationToken: jest.fn(),
    completeRegistration: jest.fn(),
    getRegistrationOptions: jest.fn(),
  },
}));

// Mock @simplewebauthn/browser
jest.mock('@simplewebauthn/browser', () => ({
  startRegistration: jest.fn(),
}));

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>;
const mockStartRegistration = startRegistration as jest.MockedFunction<typeof startRegistration>;

describe('Register Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: passkey support enabled for tests
    (globalThis as { __TEST_PASSKEY_SUPPORT__?: boolean }).__TEST_PASSKEY_SUPPORT__ = true;

    // Default: not authenticated
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: false,
      user: null,
    });
  });

  afterEach(() => {
    // Clean up test globals
    delete (globalThis as { __TEST_PASSKEY_SUPPORT__?: boolean }).__TEST_PASSKEY_SUPPORT__;
  });

  /**
   * Render Register page with a token query parameter
   */
  const renderRegisterPage = (token: string = 'valid-token-123') => {
    return render(
      <MemoryRouter initialEntries={[`/register?token=${token}`]}>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  describe('Token Validation', () => {
    it('should validate token on mount and display email', async () => {
      mockApiClient.validateRegistrationToken.mockResolvedValue({
        valid: true,
        email: 'newuser@example.com',
      });

      renderRegisterPage('valid-token-123');

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
      });
    });

    it('should show registration form when token is valid', async () => {
      mockApiClient.validateRegistrationToken.mockResolvedValue({
        valid: true,
        email: 'formuser@example.com',
      });

      renderRegisterPage('valid-token-123');

      await waitFor(() => {
        // Name input should be visible
        const nameInput = screen.getByLabelText(/name/i);
        // @ts-expect-error - jest-dom matchers
        expect(nameInput).toBeInTheDocument();
      });
    });

    it('should show error message for invalid token', async () => {
      mockApiClient.validateRegistrationToken.mockRejectedValue(
        new Error('Invalid or expired token')
      );

      renderRegisterPage('invalid-token');

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage.textContent).toMatch(/invalid|expired/i);
      });
    });

    it('should not show registration form for invalid token', async () => {
      mockApiClient.validateRegistrationToken.mockRejectedValue(
        new Error('Invalid or expired token')
      );

      renderRegisterPage('invalid-token');

      await waitFor(() => {
        // Wait for error to show
        const errorMessage = screen.getByRole('alert');
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });

      // Name input should NOT be visible
      const nameInput = screen.queryByLabelText(/name/i);
      expect(nameInput).toBeNull();
    });

    it('should show loading state while validating token', async () => {
      // Delay the resolution to observe loading state
      mockApiClient.validateRegistrationToken.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve({ valid: true, email: 'test@example.com' }), 100);
          })
      );

      renderRegisterPage('valid-token-123');

      // Should show loading indicator
      const loadingText = screen.getByText(/validating|loading/i);
      // @ts-expect-error - jest-dom matchers
      expect(loadingText).toBeInTheDocument();
    });

    it('should redirect to login if token is missing', async () => {
      render(
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <Routes>
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<div>Login Page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });
  });

  describe('Registration Form', () => {
    beforeEach(() => {
      mockApiClient.validateRegistrationToken.mockResolvedValue({
        valid: true,
        email: 'formuser@example.com',
      });
    });

    it('should allow entering a name', async () => {
      renderRegisterPage();

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/name/i);
        fireEvent.change(nameInput, { target: { value: 'John Doe' } });
        expect(nameInput).toHaveValue('John Doe');
      });
    });

    it('should disable submit button when name is empty', async () => {
      renderRegisterPage();

      await waitFor(() => {
        const submitButton = screen.getByRole('button', {
          name: /create.*account|register|continue/i,
        });
        // @ts-expect-error - jest-dom matchers
        expect(submitButton).toBeDisabled();
      });
    });

    it('should enable submit button when name is entered', async () => {
      renderRegisterPage();

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/name/i);
        fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      });

      const submitButton = screen.getByRole('button', {
        name: /create.*account|register|continue/i,
      });
      // @ts-expect-error - jest-dom matchers
      expect(submitButton).not.toBeDisabled();
    });

    it('should show email as read-only/display text', async () => {
      renderRegisterPage();

      await waitFor(() => {
        const emailText = screen.getByText('formuser@example.com');
        // @ts-expect-error - jest-dom matchers
        expect(emailText).toBeInTheDocument();
      });

      // Email should not be an editable input
      const emailInput = screen.queryByLabelText(/email/i);
      if (emailInput) {
        // @ts-expect-error - jest-dom matchers
        expect(emailInput).toHaveAttribute('readonly');
      }
    });
  });

  describe('Passkey Registration', () => {
    beforeEach(() => {
      mockApiClient.validateRegistrationToken.mockResolvedValue({
        valid: true,
        email: 'passkey@example.com',
      });
    });

    it('should trigger passkey registration on form submit', async () => {
      mockApiClient.getRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
        rp: { name: 'Clack Track', id: 'localhost' },
        user: {
          id: 'user-123',
          name: 'passkey@example.com',
          displayName: 'passkey',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
      });

      mockApiClient.completeRegistration.mockResolvedValue({
        success: true,
        user: { id: 1, name: 'John Doe', email: 'passkey@example.com' },
        authenticated: true,
      });

      mockStartRegistration.mockResolvedValue({
        id: 'new-credential-id',
        rawId: 'new-raw-id',
        response: {
          clientDataJSON: 'test-client-data',
          attestationObject: 'test-attestation',
        },
        type: 'public-key',
      } as never);

      renderRegisterPage();

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/name/i);
        fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      });

      const submitButton = screen.getByRole('button', {
        name: /create.*account|register|continue/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockStartRegistration).toHaveBeenCalled();
      });
    });

    it('should complete registration and create account', async () => {
      mockApiClient.getRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
        rp: { name: 'Clack Track', id: 'localhost' },
        user: {
          id: 'user-123',
          name: 'passkey@example.com',
          displayName: 'passkey',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
      });

      mockApiClient.completeRegistration.mockResolvedValue({
        success: true,
        user: { id: 1, name: 'Jane Doe', email: 'passkey@example.com' },
        authenticated: true,
      });

      mockStartRegistration.mockResolvedValue({
        id: 'new-credential-id',
        rawId: 'new-raw-id',
        response: {
          clientDataJSON: 'test-client-data',
          attestationObject: 'test-attestation',
        },
        type: 'public-key',
      } as never);

      renderRegisterPage();

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/name/i);
        fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
      });

      const submitButton = screen.getByRole('button', {
        name: /create.*account|register|continue/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApiClient.completeRegistration).toHaveBeenCalledWith(
          expect.objectContaining({
            token: 'valid-token-123',
            name: 'Jane Doe',
            credential: expect.any(Object),
          })
        );
      });
    });

    it('should show error if passkey registration fails', async () => {
      mockStartRegistration.mockRejectedValue(new Error('User cancelled'));

      renderRegisterPage();

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/name/i);
        fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      });

      const submitButton = screen.getByRole('button', {
        name: /create.*account|register|continue/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should show error if server registration fails', async () => {
      mockApiClient.getRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
        rp: { name: 'Clack Track', id: 'localhost' },
        user: {
          id: 'user-123',
          name: 'passkey@example.com',
          displayName: 'passkey',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
      });

      mockStartRegistration.mockResolvedValue({
        id: 'new-credential-id',
        rawId: 'new-raw-id',
        response: {
          clientDataJSON: 'test-client-data',
          attestationObject: 'test-attestation',
        },
        type: 'public-key',
      } as never);

      mockApiClient.completeRegistration.mockRejectedValue(
        new Error('Registration failed: User already exists')
      );

      renderRegisterPage();

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/name/i);
        fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      });

      const submitButton = screen.getByRole('button', {
        name: /create.*account|register|continue/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage.textContent).toMatch(/failed|error|exists/i);
      });
    });

    it('should redirect to home after successful registration', async () => {
      mockApiClient.getRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
        rp: { name: 'Clack Track', id: 'localhost' },
        user: {
          id: 'user-123',
          name: 'passkey@example.com',
          displayName: 'passkey',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
      });

      mockApiClient.completeRegistration.mockResolvedValue({
        success: true,
        user: { id: 1, name: 'John Doe', email: 'passkey@example.com' },
        authenticated: true,
      });

      mockStartRegistration.mockResolvedValue({
        id: 'new-credential-id',
        rawId: 'new-raw-id',
        response: {
          clientDataJSON: 'test-client-data',
          attestationObject: 'test-attestation',
        },
        type: 'public-key',
      } as never);

      renderRegisterPage();

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/name/i);
        fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      });

      const submitButton = screen.getByRole('button', {
        name: /create.*account|register|continue/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('Home Page')).toBeInTheDocument();
      });
    });
  });

  describe('Browser Support', () => {
    it('should show warning if passkeys are not supported', async () => {
      // Disable passkey support for this test
      (globalThis as { __TEST_PASSKEY_SUPPORT__?: boolean }).__TEST_PASSKEY_SUPPORT__ = false;

      mockApiClient.validateRegistrationToken.mockResolvedValue({
        valid: true,
        email: 'nosupport@example.com',
      });

      renderRegisterPage();

      await waitFor(() => {
        const warningMessage = screen.getByRole('alert');
        // @ts-expect-error - jest-dom matchers
        expect(warningMessage).toBeInTheDocument();
        expect(warningMessage.textContent).toMatch(
          /browser.*not.*supported|passkey.*not.*available/i
        );
      });
    });
  });

  describe('Already Authenticated', () => {
    it('should redirect to home if user is already authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Existing User' },
      });

      renderRegisterPage();

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('Home Page')).toBeInTheDocument();
      });
    });
  });

  describe('Page Content', () => {
    beforeEach(() => {
      mockApiClient.validateRegistrationToken.mockResolvedValue({
        valid: true,
        email: 'content@example.com',
      });
    });

    it('should display registration page title', async () => {
      renderRegisterPage();

      // Wait for token validation to complete first
      await waitFor(() => {
        const emailText = screen.getByText('content@example.com');
        // @ts-expect-error - jest-dom matchers
        expect(emailText).toBeInTheDocument();
      });

      // Now check for the title text
      const title = screen.getByText('Create Your Account');
      // @ts-expect-error - jest-dom matchers
      expect(title).toBeInTheDocument();
    });

    it('should have link to login page', async () => {
      renderRegisterPage();

      // Wait for token validation to complete first
      await waitFor(() => {
        const emailText = screen.getByText('content@example.com');
        // @ts-expect-error - jest-dom matchers
        expect(emailText).toBeInTheDocument();
      });

      // Now check for the login link - use getByRole for specificity
      const loginLink = screen.getByRole('link', { name: /sign.*in/i });
      // @ts-expect-error - jest-dom matchers
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });
});
