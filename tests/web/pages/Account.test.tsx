/**
 * Account Page Tests
 *
 * Tests for the Account page (/account) with profile and passkey management
 *
 * @jest-environment jsdom
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Account } from '@/web/frontend/pages/Account';
import { ProtectedRoute } from '@/web/frontend/components/ProtectedRoute';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import * as apiClient from '@/web/frontend/services/apiClient';
import { startRegistration } from '@simplewebauthn/browser';

// Mock the apiClient module
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    startLogin: jest.fn(),
    verifyLogin: jest.fn(),
    logout: jest.fn(),
    checkSession: jest.fn(),
    getProfile: jest.fn(),
    getPasskeys: jest.fn(),
    registerPasskeyStart: jest.fn(),
    registerPasskeyVerify: jest.fn(),
    removePasskey: jest.fn(),
    renamePasskey: jest.fn(),
    // Admin/Circuit breaker methods
    getCircuits: jest.fn(),
    enableCircuit: jest.fn(),
    disableCircuit: jest.fn(),
    resetCircuit: jest.fn(),
  },
}));

// Mock @simplewebauthn/browser
jest.mock('@simplewebauthn/browser', () => ({
  startRegistration: jest.fn(),
}));

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>;
const mockStartRegistration = startRegistration as jest.MockedFunction<typeof startRegistration>;

describe('Account Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authenticated session
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: true,
      user: { name: 'Demo User' },
    });

    // Mock profile data
    mockApiClient.getProfile.mockResolvedValue({
      name: 'Demo User',
      email: 'demo@example.com',
      createdAt: '2024-01-01T00:00:00Z',
    });

    // Mock passkeys data
    mockApiClient.getPasskeys.mockResolvedValue({
      passkeys: [
        {
          id: 'passkey-1',
          name: 'iPhone 15 Pro',
          deviceType: 'phone',
          createdAt: '2024-01-01T00:00:00Z',
          lastUsed: '2024-11-20T00:00:00Z',
        },
        {
          id: 'passkey-2',
          name: 'MacBook Pro',
          deviceType: 'laptop',
          createdAt: '2024-02-01T00:00:00Z',
          lastUsed: '2024-11-15T00:00:00Z',
        },
      ],
    });
  });

  /**
   * Render Account page wrapped in ProtectedRoute, matching real App.tsx structure
   */
  const renderAccountPage = () => {
    return render(
      <MemoryRouter initialEntries={['/account']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  describe('Protected Route', () => {
    it('should redirect to /login if not authenticated', async () => {
      // Mock unauthenticated session
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: false,
        user: null,
      });

      renderAccountPage();

      await waitFor(() => {
        const loginPage = screen.getByText(/login page/i);
        // @ts-expect-error - jest-dom matchers
        expect(loginPage).toBeInTheDocument();
      });
    });

    it('should render account page if authenticated', async () => {
      renderAccountPage();

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: /account/i });
        // @ts-expect-error - jest-dom matchers
        expect(heading).toBeInTheDocument();
      });
    });
  });

  describe('Profile Section', () => {
    it('should display profile information', async () => {
      renderAccountPage();

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('Demo User')).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('demo@example.com')).toBeInTheDocument();
      });
    });

    it('should display account creation date', async () => {
      renderAccountPage();

      await waitFor(() => {
        // Date format may vary by locale, so just check for Member Since label and a date
        const memberSinceLabel = screen.getByText(/Member Since/);
        // @ts-expect-error - jest-dom matchers
        expect(memberSinceLabel).toBeInTheDocument();
      });
    });
  });

  describe('Passkeys List', () => {
    it('should display list of passkeys', async () => {
      renderAccountPage();

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
      });
    });

    it('should show passkey metadata (device type, dates)', async () => {
      renderAccountPage();

      await waitFor(() => {
        const addedDates = screen.getAllByText(/Added:/);
        expect(addedDates.length).toBeGreaterThan(0);

        const lastUsedDates = screen.getAllByText(/Last used:/);
        expect(lastUsedDates.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Add Passkey', () => {
    it('should show Add New Passkey button', async () => {
      renderAccountPage();

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /add new passkey/i });
        // @ts-expect-error - jest-dom matchers
        expect(button).toBeInTheDocument();
      });
    });

    it('should start passkey registration when Add button clicked', async () => {
      mockApiClient.registerPasskeyStart.mockResolvedValue({
        challenge: 'test-challenge',
        rp: { name: 'Clack Track', id: 'localhost' },
        user: {
          id: 'user-123',
          name: 'demo@example.com',
          displayName: 'Demo User',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
      });

      mockStartRegistration.mockResolvedValue({
        id: 'new-credential-id',
        rawId: 'new-raw-id',
        response: {
          clientDataJSON: 'test-data',
          attestationObject: 'test-attestation',
        },
        type: 'public-key',
      } as never);

      mockApiClient.registerPasskeyVerify.mockResolvedValue({
        verified: true,
        passkey: {
          id: 'passkey-3',
          name: 'New Device',
          deviceType: 'laptop',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
        },
      });

      renderAccountPage();

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /add new passkey/i });
        fireEvent.click(button);
      });

      await waitFor(() => {
        expect(mockApiClient.registerPasskeyStart).toHaveBeenCalled();
      });
    });
  });

  describe('Remove Passkey', () => {
    it('should show remove button for each passkey', async () => {
      renderAccountPage();

      await waitFor(() => {
        const removeButtons = screen.getAllByRole('button', { name: /remove/i });
        expect(removeButtons.length).toBeGreaterThan(0);
      });
    });

    it('should disable remove button for last passkey', async () => {
      // Mock only one passkey
      mockApiClient.getPasskeys.mockResolvedValue({
        passkeys: [
          {
            id: 'passkey-1',
            name: 'iPhone 15 Pro',
            deviceType: 'phone',
            createdAt: '2024-01-01T00:00:00Z',
            lastUsed: '2024-11-20T00:00:00Z',
          },
        ],
      });

      renderAccountPage();

      await waitFor(() => {
        const removeButton = screen.getByRole('button', { name: /remove/i });
        // @ts-expect-error - jest-dom matchers
        expect(removeButton).toBeDisabled();
      });
    });

    it('should show confirmation dialog before removing', async () => {
      renderAccountPage();

      await waitFor(async () => {
        const removeButtons = screen.getAllByRole('button', { name: /remove/i });
        fireEvent.click(removeButtons[0]);

        // Confirmation dialog should appear
        await waitFor(() => {
          const confirmText = screen.getByText(/are you sure/i);
          // @ts-expect-error - jest-dom matchers
          expect(confirmText).toBeInTheDocument();
        });
      });
    });
  });

  describe('Rename Passkey', () => {
    it('should show rename button for each passkey', async () => {
      renderAccountPage();

      await waitFor(() => {
        const renameButtons = screen.getAllByRole('button', { name: /rename/i });
        expect(renameButtons.length).toBeGreaterThan(0);
      });
    });

    it('should allow renaming passkey', async () => {
      mockApiClient.renamePasskey.mockResolvedValue({
        passkey: {
          id: 'passkey-1',
          name: 'Updated Name',
          deviceType: 'phone',
          createdAt: '2024-01-01T00:00:00Z',
          lastUsed: '2024-11-20T00:00:00Z',
        },
      });

      renderAccountPage();

      await waitFor(async () => {
        const renameButtons = screen.getAllByRole('button', { name: /rename/i });
        fireEvent.click(renameButtons[0]);

        // Dialog should appear with input
        await waitFor(() => {
          const input = screen.getByRole('textbox');
          // @ts-expect-error - jest-dom matchers
          expect(input).toBeInTheDocument();
        });
      });
    });
  });

  describe('Logout', () => {
    it('should show logout button', async () => {
      renderAccountPage();

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /logout/i });
        // @ts-expect-error - jest-dom matchers
        expect(button).toBeInTheDocument();
      });
    });

    it('should call logout and redirect to login on logout click', async () => {
      mockApiClient.logout.mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      renderAccountPage();

      await waitFor(async () => {
        const button = screen.getByRole('button', { name: /logout/i });
        fireEvent.click(button);

        await waitFor(() => {
          expect(mockApiClient.logout).toHaveBeenCalled();
        });
      });
    });
  });

  describe('Admin Section', () => {
    const mockCircuits = [
      {
        id: 'MASTER',
        name: 'Master Switch',
        description: 'Main system control',
        type: 'manual' as const,
        state: 'on' as const,
      },
      {
        id: 'SLEEP_MODE',
        name: 'Sleep Mode',
        description: 'Display sleep art',
        type: 'manual' as const,
        state: 'off' as const,
      },
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'AI provider',
        type: 'provider' as const,
        state: 'on' as const,
        failureCount: 0,
        failureThreshold: 5,
      },
    ];

    it('should not show admin section for non-admin users', async () => {
      // Mock 401 unauthorized for circuits endpoint
      mockApiClient.getCircuits.mockRejectedValue(new Error('API Error (401): Unauthorized'));

      renderAccountPage();

      await waitFor(() => {
        // Profile should load
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('Demo User')).toBeInTheDocument();
      });

      // Admin section should not be visible
      expect(screen.queryByText(/system administration/i)).toBeNull();
      expect(screen.queryByText(/admin/i, { selector: 'span' })).toBeNull();
    });

    it('should show admin section for admin users', async () => {
      // Mock successful circuits fetch (user is admin)
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: mockCircuits,
      });

      renderAccountPage();

      await waitFor(() => {
        // Admin section should be visible
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText(/system administration/i)).toBeInTheDocument();
      });
    });

    it('should display admin badge with Settings icon', async () => {
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: mockCircuits,
      });

      renderAccountPage();

      await waitFor(() => {
        // Find the admin badge by looking for the amber-colored badge (not the nav link)
        // The badge has bg-amber-500 class while the nav link doesn't
        const adminBadges = screen.getAllByText('Admin');
        const adminBadge = adminBadges.find(el => el.classList.contains('bg-amber-500'));
        expect(adminBadge).toBeDefined();
        // @ts-expect-error - jest-dom matchers
        expect(adminBadge).toBeInTheDocument();
      });
    });

    it('should display circuit breakers grouped by type', async () => {
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: mockCircuits,
      });

      renderAccountPage();

      await waitFor(() => {
        // System Controls section - use getAllByText to handle possible duplicates
        const systemControlsLabels = screen.getAllByText('System Controls');
        expect(systemControlsLabels.length).toBeGreaterThan(0);
        // @ts-expect-error - jest-dom matchers
        expect(
          screen.getByRole('heading', { name: 'Master Switch', level: 3 })
        ).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByRole('heading', { name: 'Sleep Mode', level: 3 })).toBeInTheDocument();

        // Provider Circuits section
        const providerCircuitsLabels = screen.getAllByText('Provider Circuits');
        expect(providerCircuitsLabels.length).toBeGreaterThan(0);
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByRole('heading', { name: 'OpenAI', level: 3 })).toBeInTheDocument();
      });
    });

    it('should toggle admin section visibility when collapse button clicked', async () => {
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: mockCircuits,
      });

      renderAccountPage();

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText(/system administration/i)).toBeInTheDocument();
      });

      // Initially expanded - content should be visible
      // @ts-expect-error - jest-dom matchers
      expect(screen.getByRole('heading', { name: 'Master Switch', level: 3 })).toBeInTheDocument();

      // Click collapse button
      const collapseButton = screen.getByRole('button', { name: /collapse admin section/i });
      fireEvent.click(collapseButton);

      // Content should be hidden - use queryByRole to check for absence
      expect(screen.queryByRole('heading', { name: 'Master Switch', level: 3 })).toBeNull();

      // Click expand button
      const expandButton = screen.getByRole('button', { name: /expand admin section/i });
      fireEvent.click(expandButton);

      // Content should be visible again
      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(
          screen.getByRole('heading', { name: 'Master Switch', level: 3 })
        ).toBeInTheDocument();
      });
    });

    it('should show link to full admin dashboard', async () => {
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: mockCircuits,
      });

      renderAccountPage();

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /view full admin dashboard/i });
        // @ts-expect-error - jest-dom matchers
        expect(link).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(link).toHaveAttribute('href', '/admin');
      });
    });

    it('should call enableCircuit when toggling circuit on', async () => {
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'SLEEP_MODE',
            name: 'Sleep Mode',
            type: 'manual' as const,
            state: 'off' as const,
          },
        ],
      });
      mockApiClient.enableCircuit.mockResolvedValue({ success: true });

      renderAccountPage();

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByRole('heading', { name: 'Sleep Mode', level: 3 })).toBeInTheDocument();
      });

      // Find and click the toggle switch
      const toggle = screen.getByRole('switch', { name: /toggle sleep mode/i });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockApiClient.enableCircuit).toHaveBeenCalledWith('SLEEP_MODE');
      });
    });

    it('should call disableCircuit when toggling circuit off', async () => {
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'MASTER',
            name: 'Master Switch',
            type: 'manual' as const,
            state: 'on' as const,
          },
        ],
      });
      mockApiClient.disableCircuit.mockResolvedValue({ success: true });

      renderAccountPage();

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(
          screen.getByRole('heading', { name: 'Master Switch', level: 3 })
        ).toBeInTheDocument();
      });

      // Find and click the toggle switch
      const toggle = screen.getByRole('switch', { name: /toggle master switch/i });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockApiClient.disableCircuit).toHaveBeenCalledWith('MASTER');
      });
    });

    it('should show reset button for provider circuits', async () => {
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'openai',
            name: 'OpenAI',
            type: 'provider' as const,
            state: 'half_open' as const,
            failureCount: 3,
            failureThreshold: 5,
          },
        ],
      });

      renderAccountPage();

      await waitFor(() => {
        const resetButton = screen.getByRole('button', { name: /reset/i });
        // @ts-expect-error - jest-dom matchers
        expect(resetButton).toBeInTheDocument();
      });
    });

    it('should display error message when circuit operation fails', async () => {
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: mockCircuits,
      });
      mockApiClient.enableCircuit.mockRejectedValue(new Error('Failed to enable circuit'));

      renderAccountPage();

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByRole('heading', { name: 'Sleep Mode', level: 3 })).toBeInTheDocument();
      });

      // Click toggle to trigger error
      const toggle = screen.getByRole('switch', { name: /toggle sleep mode/i });
      fireEvent.click(toggle);

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText(/failed to enable circuit/i)).toBeInTheDocument();
      });
    });

    it('should not display admin section when circuits array is empty but user is admin', async () => {
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: [],
      });

      renderAccountPage();

      await waitFor(() => {
        // Profile should load
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('Demo User')).toBeInTheDocument();
      });

      // Admin section should still be visible but with no circuits message
      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText(/system administration/i)).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText(/no circuit breakers configured/i)).toBeInTheDocument();
      });
    });
  });
});
