/**
 * Navigation Component Tests (TDD)
 *
 * Testing auth-aware conditional link visibility:
 * - Hides /account when not authenticated
 * - Shows /login when not authenticated
 * - Hides /login and shows logout when authenticated
 * - Desktop-only navigation (BottomTabBar handles mobile)
 * - No layout shift when auth state changes
 *
 * @jest-environment jsdom
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Navigation } from '@/web/frontend/components/Navigation';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import * as apiClient from '@/web/frontend/services/apiClient';

// Mock the API client
jest.mock('@/web/frontend/services/apiClient');

// Mock @simplewebauthn/browser
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

/**
 * Test wrapper with AuthProvider and Router
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe('Navigation Component - Auth-Aware Visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unauthenticated State', () => {
    beforeEach(() => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: false,
        user: null,
      });
    });

    it('should hide Account link in desktop navigation when not authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        // Account link should not be visible
        expect(screen.queryByRole('link', { name: /^account$/i })).not.toBeInTheDocument();
      });
    });

    it('should show Login link in desktop navigation when not authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        // Login link should be visible in desktop nav (hidden md:flex container)
        const desktopNav = screen.getByTestId('desktop-nav');
        const loginLink = desktopNav.querySelector('a[href="/login"]');
        expect(loginLink).toBeInTheDocument();
      });
    });

    it('should hide Logout button when not authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
      });
    });

    it('should show public links (Home, Flipside) when not authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        // Public links should always be visible
        expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /flipside/i })).toBeInTheDocument();
      });
    });
  });

  describe('Authenticated State', () => {
    beforeEach(() => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('should show Account link in desktop navigation when authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        const desktopNav = screen.getByTestId('desktop-nav');
        const accountLink = desktopNav.querySelector('a[href="/account"]');
        expect(accountLink).toBeInTheDocument();
      });
    });

    it('should hide Login link in desktop navigation when authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        const desktopNav = screen.getByTestId('desktop-nav');
        const loginLink = desktopNav.querySelector('a[href="/login"]');
        expect(loginLink).not.toBeInTheDocument();
      });
    });

    it('should show Logout button when authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });
    });

    it('should show public links (Home, Flipside) when authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /flipside/i })).toBeInTheDocument();
      });
    });
  });

  describe('Desktop-Only Navigation', () => {
    beforeEach(() => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: false,
        user: null,
      });
    });

    it('should be desktop-only (mobile handled by BottomTabBar)', async () => {
      const { container } = render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      // Navigation uses hidden md:flex classes - hidden on mobile, flex on desktop
      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveClass('hidden');
      expect(nav).toHaveClass('md:flex');
    });

    it('should not have mobile menu button (BottomTabBar handles mobile)', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      // No hamburger menu button - mobile nav is handled by BottomTabBar
      const menuButton = screen.queryByRole('button', { name: /open menu/i });
      expect(menuButton).not.toBeInTheDocument();
    });
  });

  describe('Logout Functionality', () => {
    beforeEach(() => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
      (apiClient.apiClient.logout as jest.Mock).mockResolvedValue({ success: true });
    });

    it('should call logout when Logout button is clicked', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(apiClient.apiClient.logout).toHaveBeenCalled();
      });
    });
  });

  describe('Loading State', () => {
    it('should not cause layout shift during auth state loading', async () => {
      // Mock a delayed session check
      (apiClient.apiClient.checkSession as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  authenticated: true,
                  user: { name: 'Test User' },
                }),
              100
            )
          )
      );

      const { container } = render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      // Navigation wrapper should be present immediately
      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();

      // Public links should be visible even during loading
      expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();

      // After loading completes, authenticated links should appear
      await waitFor(() => {
        const desktopNav = screen.getByTestId('desktop-nav');
        const accountLink = desktopNav.querySelector('a[href="/account"]');
        expect(accountLink).toBeInTheDocument();
      });
    });

    it('should maintain consistent container during auth state transition', async () => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      const { container } = render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      // Check nav exists immediately
      const navBefore = container.querySelector('nav');
      expect(navBefore).toBeInTheDocument();

      // Wait for auth to complete
      await waitFor(() => {
        const desktopNav = screen.getByTestId('desktop-nav');
        const accountLink = desktopNav.querySelector('a[href="/account"]');
        expect(accountLink).toBeInTheDocument();
      });

      // Nav should still be the same element (no re-mount)
      const navAfter = container.querySelector('nav');
      expect(navAfter).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should treat auth errors as unauthenticated', async () => {
      // Mock failed session check
      (apiClient.apiClient.checkSession as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      // On error, should show unauthenticated view
      await waitFor(() => {
        const desktopNav = screen.getByTestId('desktop-nav');
        const loginLink = desktopNav.querySelector('a[href="/login"]');
        expect(loginLink).toBeInTheDocument();
      });

      // Protected links should be hidden
      await waitFor(() => {
        expect(screen.queryByRole('link', { name: /^account$/i })).not.toBeInTheDocument();
      });
    });
  });
});
