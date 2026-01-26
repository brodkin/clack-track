/**
 * AuthGuard Component Tests (TDD - RED Phase)
 *
 * Testing conditional rendering based on authentication state:
 * - Renders children only when authenticated
 * - Shows fallback when not authenticated
 * - Supports role-based visibility (stub for future)
 * - No layout shift when auth state changes
 *
 * @jest-environment jsdom
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AuthGuard } from '@/web/frontend/components/AuthGuard';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import * as apiClient from '@/web/frontend/services/apiClient';

// Mock the API client
jest.mock('@/web/frontend/services/apiClient');

// Mock @simplewebauthn/browser
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

/**
 * Test wrapper that provides AuthProvider context
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthGuard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authenticated State', () => {
    beforeEach(() => {
      // Mock authenticated session
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('should render children when authenticated', async () => {
      render(
        <TestWrapper>
          <AuthGuard>
            <div data-testid="protected-content">Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });

    it('should not render fallback when authenticated', async () => {
      render(
        <TestWrapper>
          <AuthGuard fallback={<div data-testid="fallback">Login Required</div>}>
            <div data-testid="protected-content">Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    });
  });

  describe('Unauthenticated State', () => {
    beforeEach(() => {
      // Mock unauthenticated session
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: false,
        user: null,
      });
    });

    it('should not render children when not authenticated', async () => {
      render(
        <TestWrapper>
          <AuthGuard>
            <div data-testid="protected-content">Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      });
    });

    it('should render fallback when not authenticated', async () => {
      render(
        <TestWrapper>
          <AuthGuard fallback={<div data-testid="fallback">Please Login</div>}>
            <div data-testid="protected-content">Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should render nothing by default when not authenticated and no fallback provided', async () => {
      const { container } = render(
        <TestWrapper>
          <AuthGuard>
            <div data-testid="protected-content">Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      });

      // Container should have the wrapper but no visible content
      expect(container.querySelector('[data-testid="auth-guard"]')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should not cause layout shift during loading', async () => {
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
          <AuthGuard>
            <div data-testid="protected-content">Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      // During loading, wrapper should still be present for consistent sizing
      const guard = container.querySelector('[data-testid="auth-guard"]');
      expect(guard).toBeInTheDocument();

      // After loading completes
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });

    it('should maintain consistent container during auth state transition', async () => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      const { container } = render(
        <TestWrapper>
          <AuthGuard>
            <div data-testid="protected-content">Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      // Check wrapper exists immediately
      const guardBefore = container.querySelector('[data-testid="auth-guard"]');
      expect(guardBefore).toBeInTheDocument();

      // Wait for auth to complete
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      // Wrapper should still be the same element (no re-mount)
      const guardAfter = container.querySelector('[data-testid="auth-guard"]');
      expect(guardAfter).toBeInTheDocument();
    });
  });

  describe('Role-Based Visibility (Future)', () => {
    beforeEach(() => {
      // Mock authenticated session
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('should accept require prop for role-based visibility (stub)', async () => {
      render(
        <TestWrapper>
          <AuthGuard require="admin">
            <div data-testid="admin-content">Admin Only</div>
          </AuthGuard>
        </TestWrapper>
      );

      // For now, role checking is stubbed - authenticated users see content
      await waitFor(() => {
        expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      });
    });

    it('should support require prop with fallback', async () => {
      render(
        <TestWrapper>
          <AuthGuard require="admin" fallback={<div data-testid="no-access">No Access</div>}>
            <div data-testid="admin-content">Admin Only</div>
          </AuthGuard>
        </TestWrapper>
      );

      // Stub behavior: authenticated users see content regardless of role
      await waitFor(() => {
        expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      });
    });
  });

  describe('Nested Usage', () => {
    beforeEach(() => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('should support nested AuthGuards', async () => {
      render(
        <TestWrapper>
          <AuthGuard>
            <div data-testid="outer-content">
              Outer Content
              <AuthGuard require="admin">
                <div data-testid="inner-content">Inner Admin Content</div>
              </AuthGuard>
            </div>
          </AuthGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('outer-content')).toBeInTheDocument();
        expect(screen.getByTestId('inner-content')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: false,
        user: null,
      });
    });

    it('should have accessible wrapper element', async () => {
      render(
        <TestWrapper>
          <AuthGuard fallback={<div data-testid="fallback">Please login to continue</div>}>
            <div data-testid="protected-content">Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument();
      });

      // Fallback should be accessible
      const fallback = screen.getByTestId('fallback');
      expect(fallback).toHaveTextContent('Please login to continue');
    });
  });

  describe('Edge Cases', () => {
    it('should handle session check errors gracefully', async () => {
      // Mock failed session check
      (apiClient.apiClient.checkSession as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <AuthGuard fallback={<div data-testid="fallback">Please Login</div>}>
            <div data-testid="protected-content">Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      // On error, should treat as unauthenticated and show fallback
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should render multiple children correctly when authenticated', async () => {
      (apiClient.apiClient.checkSession as jest.Mock).mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      render(
        <TestWrapper>
          <AuthGuard>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
          </AuthGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child-1')).toBeInTheDocument();
        expect(screen.getByTestId('child-2')).toBeInTheDocument();
      });
    });
  });
});
