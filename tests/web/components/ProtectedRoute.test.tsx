/**
 * ProtectedRoute Component Tests
 *
 * Tests for the reusable route wrapper that checks authentication:
 * - Loading state (shows spinner while checking auth)
 * - Redirect state (redirects to /login with return URL if not authenticated)
 * - Render state (renders children when authenticated)
 *
 * @jest-environment jsdom
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ProtectedRoute } from '@/web/frontend/components/ProtectedRoute';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import * as apiClient from '@/web/frontend/services/apiClient';

// Mock the apiClient module
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    checkSession: jest.fn(),
    startLogin: jest.fn(),
    verifyLogin: jest.fn(),
    logout: jest.fn(),
  },
}));

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>;

/**
 * Helper component to capture current location for assertions
 */
function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location-display">
      <span data-testid="pathname">{location.pathname}</span>
      <span data-testid="search">{location.search}</span>
    </div>
  );
}

/**
 * Protected content component for testing
 */
function ProtectedContent() {
  return <div data-testid="protected-content">Protected Content Visible</div>;
}

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner while checking authentication', async () => {
      // Mock session check that never resolves (simulates loading)
      mockApiClient.checkSession.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Should show loading indicator
      const loadingIndicator = screen.getByRole('status');
      // @ts-expect-error - jest-dom matchers
      expect(loadingIndicator).toBeInTheDocument();
      expect(loadingIndicator).toHaveAttribute('aria-label', 'Loading');

      // Protected content should NOT be visible during loading
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    it('should display loading text', async () => {
      mockApiClient.checkSession.mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      const loadingText = screen.getByText(/loading/i);
      // @ts-expect-error - jest-dom matchers
      expect(loadingText).toBeInTheDocument();
    });
  });

  describe('Redirect State (Unauthenticated)', () => {
    it('should redirect to /login when not authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: false,
        user: null,
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LocationDisplay />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        const pathname = screen.getByTestId('pathname');
        expect(pathname.textContent).toBe('/login');
      });

      // Protected content should NOT be visible
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    it('should include return URL as query parameter when redirecting', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: false,
        user: null,
      });

      render(
        <MemoryRouter initialEntries={['/account']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LocationDisplay />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        const search = screen.getByTestId('search');
        expect(search.textContent).toContain('returnUrl');
        expect(search.textContent).toContain('%2Faccount');
      });
    });

    it('should encode complex return URLs correctly', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: false,
        user: null,
      });

      render(
        <MemoryRouter initialEntries={['/protected/path?query=value']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected/path"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LocationDisplay />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        const search = screen.getByTestId('search');
        // Should contain encoded path
        expect(search.textContent).toContain('returnUrl=');
      });
    });
  });

  describe('Render State (Authenticated)', () => {
    it('should render children when authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        const content = screen.getByTestId('protected-content');
        // @ts-expect-error - jest-dom matchers
        expect(content).toBeInTheDocument();
      });

      expect(screen.getByText('Protected Content Visible')).toBeTruthy();
    });

    it('should not show loading spinner when authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeTruthy();
      });

      // Loading spinner should not be visible
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('should render multiple children correctly', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <div data-testid="child-1">Child 1</div>
                    <div data-testid="child-2">Child 2</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('child-1')).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('child-2')).toBeInTheDocument();
      });
    });
  });

  describe('AuthContext Integration', () => {
    it('should use AuthContext for authentication state', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Should have called checkSession via AuthProvider
      await waitFor(() => {
        expect(mockApiClient.checkSession).toHaveBeenCalledTimes(1);
      });
    });

    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        render(
          <MemoryRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        );
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });
  });

  describe('Session Check Failure', () => {
    it('should redirect to login when session check fails', async () => {
      mockApiClient.checkSession.mockRejectedValue(new Error('Network error'));

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LocationDisplay />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // On session check failure, AuthContext sets authenticated to false
      await waitFor(() => {
        const pathname = screen.getByTestId('pathname');
        expect(pathname.textContent).toBe('/login');
      });
    });
  });
});
