/**
 * Comprehensive Frontend Auth Components Integration Tests
 *
 * Tests all auth components working together in realistic scenarios:
 * - ProtectedRoute: loading state, redirect behavior, authenticated render
 * - useRequireAuth: hook returns correct state, handles redirects
 * - AuthGuard: conditional rendering, fallback prop, no layout shift
 * - Account page with ProtectedRoute pattern
 * - Admin page with ProtectedRoute pattern
 * - Navigation auth-aware link visibility
 *
 * @jest-environment jsdom
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type React from 'react';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import { ProtectedRoute } from '@/web/frontend/components/ProtectedRoute';
import { AuthGuard } from '@/web/frontend/components/AuthGuard';
import { useRequireAuth } from '@/web/frontend/hooks/useRequireAuth';
import { Navigation } from '@/web/frontend/components/Navigation';
import * as apiClient from '@/web/frontend/services/apiClient';

// Mock the apiClient module
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    checkSession: jest.fn(),
    startLogin: jest.fn(),
    verifyLogin: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    getPasskeys: jest.fn(),
    registerPasskeyStart: jest.fn(),
    registerPasskeyVerify: jest.fn(),
    removePasskey: jest.fn(),
    renamePasskey: jest.fn(),
    getCircuits: jest.fn(),
    enableCircuit: jest.fn(),
    disableCircuit: jest.fn(),
    resetCircuit: jest.fn(),
  },
}));

// Mock @simplewebauthn/browser
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
  startRegistration: jest.fn(),
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
 * Test component that uses useRequireAuth hook
 */
function UseRequireAuthTestComponent({
  options,
}: {
  options?: { redirect?: boolean; redirectTo?: string };
}) {
  const { isLoading, isAuthenticated, user } = useRequireAuth(options);

  return (
    <div data-testid="hook-test">
      <span data-testid="is-loading">{String(isLoading)}</span>
      <span data-testid="is-authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user-name">{user?.name ?? 'null'}</span>
    </div>
  );
}

describe('Frontend Auth Components Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // SECTION 1: ProtectedRoute Component Tests
  // ============================================================
  describe('ProtectedRoute Component', () => {
    describe('Loading State', () => {
      it('should show loading spinner with accessible role and aria-label', async () => {
        // Session check never resolves to observe loading state
        mockApiClient.checkSession.mockImplementation(() => new Promise(() => {}));

        render(
          <MemoryRouter initialEntries={['/protected']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/protected"
                  element={
                    <ProtectedRoute>
                      <div data-testid="content">Protected</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        const spinner = screen.getByRole('status');
        // @ts-expect-error - jest-dom matchers
        expect(spinner).toBeInTheDocument();
        expect(spinner).toHaveAttribute('aria-label', 'Loading');
      });

      it('should display Loading... text during authentication check', () => {
        mockApiClient.checkSession.mockImplementation(() => new Promise(() => {}));

        render(
          <MemoryRouter initialEntries={['/protected']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/protected"
                  element={
                    <ProtectedRoute>
                      <div>Protected</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      it('should not render protected content during loading', () => {
        mockApiClient.checkSession.mockImplementation(() => new Promise(() => {}));

        render(
          <MemoryRouter initialEntries={['/protected']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/protected"
                  element={
                    <ProtectedRoute>
                      <div data-testid="protected-content">Secret Data</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        expect(screen.queryByTestId('protected-content')).toBeNull();
      });
    });

    describe('Redirect Behavior', () => {
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
                      <div>Protected</div>
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LocationDisplay />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('pathname').textContent).toBe('/login');
        });
      });

      it('should include encoded returnUrl when redirecting from /account', async () => {
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
                      <div>Account</div>
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LocationDisplay />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          const search = screen.getByTestId('search').textContent;
          expect(search).toContain('returnUrl=%2Faccount');
        });
      });

      it('should include encoded returnUrl when redirecting from /admin', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });

        render(
          <MemoryRouter initialEntries={['/admin']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <div>Admin</div>
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LocationDisplay />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          const search = screen.getByTestId('search').textContent;
          expect(search).toContain('returnUrl=%2Fadmin');
        });
      });

      it('should preserve query parameters in returnUrl', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });

        render(
          <MemoryRouter initialEntries={['/account?tab=passkeys']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <div>Account</div>
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LocationDisplay />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          const search = screen.getByTestId('search').textContent;
          expect(search).toContain('returnUrl=');
          // URL-encoded /account?tab=passkeys
          expect(search).toContain('%2Faccount');
        });
      });
    });

    describe('Authenticated Render', () => {
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
                      <div data-testid="protected-content">Protected Content</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('protected-content')).toBeInTheDocument();
        });
      });

      it('should hide loading spinner after authentication', async () => {
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
                      <div data-testid="protected-content">Protected</div>
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

        expect(screen.queryByRole('status')).toBeNull();
      });

      it('should render nested children correctly', async () => {
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
                      <div data-testid="wrapper">
                        <h1 data-testid="title">Title</h1>
                        <p data-testid="content">Content</p>
                      </div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('wrapper')).toBeInTheDocument();
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('title')).toBeInTheDocument();
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('content')).toBeInTheDocument();
        });
      });
    });
  });

  // ============================================================
  // SECTION 2: useRequireAuth Hook Tests
  // ============================================================
  describe('useRequireAuth Hook', () => {
    describe('Return Value Structure', () => {
      it('should return isLoading, isAuthenticated, and user properties', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });

        render(
          <MemoryRouter initialEntries={['/test']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/test"
                  element={<UseRequireAuthTestComponent options={{ redirect: false }} />}
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        // All three properties should exist
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('is-loading')).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('is-authenticated')).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('user-name')).toBeInTheDocument();
      });

      it('should return isLoading=true initially', () => {
        mockApiClient.checkSession.mockImplementation(() => new Promise(() => {}));

        render(
          <MemoryRouter initialEntries={['/test']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/test"
                  element={<UseRequireAuthTestComponent options={{ redirect: false }} />}
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        expect(screen.getByTestId('is-loading').textContent).toBe('true');
      });

      it('should return isLoading=false after session check', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });

        render(
          <MemoryRouter initialEntries={['/test']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/test"
                  element={<UseRequireAuthTestComponent options={{ redirect: false }} />}
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('is-loading').textContent).toBe('false');
        });
      });

      it('should return user object when authenticated', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'John Doe' },
        });

        render(
          <MemoryRouter initialEntries={['/test']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/test"
                  element={<UseRequireAuthTestComponent options={{ redirect: false }} />}
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
          expect(screen.getByTestId('user-name').textContent).toBe('John Doe');
        });
      });

      it('should return user=null when not authenticated', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });

        render(
          <MemoryRouter initialEntries={['/test']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/test"
                  element={<UseRequireAuthTestComponent options={{ redirect: false }} />}
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
          expect(screen.getByTestId('user-name').textContent).toBe('null');
        });
      });
    });

    describe('Automatic Redirect Handling', () => {
      it('should redirect when not authenticated and redirect=true (default)', async () => {
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
                    <>
                      <UseRequireAuthTestComponent />
                      <LocationDisplay />
                    </>
                  }
                />
                <Route path="/login" element={<LocationDisplay />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('pathname').textContent).toBe('/login');
        });
      });

      it('should NOT redirect when redirect=false', async () => {
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
                    <>
                      <UseRequireAuthTestComponent options={{ redirect: false }} />
                      <LocationDisplay />
                    </>
                  }
                />
                <Route path="/login" element={<div>Login</div>} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('is-loading').textContent).toBe('false');
        });

        // Should still be on /protected
        expect(screen.getByTestId('pathname').textContent).toBe('/protected');
      });

      it('should NOT redirect when authenticated', async () => {
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
                    <>
                      <UseRequireAuthTestComponent />
                      <LocationDisplay />
                    </>
                  }
                />
                <Route path="/login" element={<div>Login</div>} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('is-loading').textContent).toBe('false');
        });

        // Should remain on /protected
        expect(screen.getByTestId('pathname').textContent).toBe('/protected');
      });

      it('should allow custom redirectTo path', async () => {
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
                    <>
                      <UseRequireAuthTestComponent options={{ redirectTo: '/custom-login' }} />
                      <LocationDisplay />
                    </>
                  }
                />
                <Route path="/custom-login" element={<LocationDisplay />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('pathname').textContent).toBe('/custom-login');
        });
      });
    });

    describe('Error Handling', () => {
      it('should treat session check errors as unauthenticated', async () => {
        mockApiClient.checkSession.mockRejectedValue(new Error('Network error'));

        render(
          <MemoryRouter initialEntries={['/test']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/test"
                  element={<UseRequireAuthTestComponent options={{ redirect: false }} />}
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('is-loading').textContent).toBe('false');
          expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
        });
      });
    });
  });

  // ============================================================
  // SECTION 3: AuthGuard Component Tests
  // ============================================================
  describe('AuthGuard Component', () => {
    describe('Conditional Rendering', () => {
      it('should render children when authenticated', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'Test User' },
        });

        render(
          <MemoryRouter>
            <AuthProvider>
              <AuthGuard>
                <div data-testid="protected">Protected Content</div>
              </AuthGuard>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('protected')).toBeInTheDocument();
        });
      });

      it('should NOT render children when not authenticated', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });

        render(
          <MemoryRouter>
            <AuthProvider>
              <AuthGuard>
                <div data-testid="protected">Protected Content</div>
              </AuthGuard>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
        });
      });
    });

    describe('Fallback Prop', () => {
      it('should render fallback when not authenticated', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });

        render(
          <MemoryRouter>
            <AuthProvider>
              <AuthGuard fallback={<div data-testid="fallback">Please Login</div>}>
                <div data-testid="protected">Protected</div>
              </AuthGuard>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('fallback')).toBeInTheDocument();
          expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
        });
      });

      it('should NOT render fallback when authenticated', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'Test User' },
        });

        render(
          <MemoryRouter>
            <AuthProvider>
              <AuthGuard fallback={<div data-testid="fallback">Please Login</div>}>
                <div data-testid="protected">Protected</div>
              </AuthGuard>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('protected')).toBeInTheDocument();
          expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
        });
      });

      it('should render nothing when not authenticated and no fallback provided', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });

        const { container } = render(
          <MemoryRouter>
            <AuthProvider>
              <AuthGuard>
                <div data-testid="protected">Protected</div>
              </AuthGuard>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
        });

        // Wrapper should still exist
        // @ts-expect-error - jest-dom matchers
        expect(container.querySelector('[data-testid="auth-guard"]')).toBeInTheDocument();
      });
    });

    describe('No Layout Shift', () => {
      it('should maintain wrapper element during loading state', async () => {
        mockApiClient.checkSession.mockImplementation(() => new Promise(() => {}));

        const { container } = render(
          <MemoryRouter>
            <AuthProvider>
              <AuthGuard>
                <div data-testid="protected">Protected</div>
              </AuthGuard>
            </AuthProvider>
          </MemoryRouter>
        );

        // Wrapper should exist immediately during loading
        const guard = container.querySelector('[data-testid="auth-guard"]');
        // @ts-expect-error - jest-dom matchers
        expect(guard).toBeInTheDocument();
      });

      it('should keep wrapper element after auth state resolves', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'Test User' },
        });

        const { container } = render(
          <MemoryRouter>
            <AuthProvider>
              <AuthGuard>
                <div data-testid="protected">Protected</div>
              </AuthGuard>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('protected')).toBeInTheDocument();
        });

        // Wrapper should still exist after loading
        // @ts-expect-error - jest-dom matchers
        expect(container.querySelector('[data-testid="auth-guard"]')).toBeInTheDocument();
      });
    });

    describe('Require Prop (Future Role Support)', () => {
      it('should accept require prop for role-based visibility', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'Admin User' },
        });

        render(
          <MemoryRouter>
            <AuthProvider>
              <AuthGuard require="admin">
                <div data-testid="admin-content">Admin Only</div>
              </AuthGuard>
            </AuthProvider>
          </MemoryRouter>
        );

        // Currently stubbed: authenticated users see content regardless of role
        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('admin-content')).toBeInTheDocument();
        });
      });
    });

    describe('Nested AuthGuards', () => {
      it('should support nested AuthGuard components', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'Test User' },
        });

        render(
          <MemoryRouter>
            <AuthProvider>
              <AuthGuard>
                <div data-testid="outer">
                  Outer Content
                  <AuthGuard require="admin">
                    <div data-testid="inner">Inner Content</div>
                  </AuthGuard>
                </div>
              </AuthGuard>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('outer')).toBeInTheDocument();
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('inner')).toBeInTheDocument();
        });
      });
    });

    describe('Multiple Children', () => {
      it('should render multiple children when authenticated', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'Test User' },
        });

        render(
          <MemoryRouter>
            <AuthProvider>
              <AuthGuard>
                <div data-testid="child-1">First</div>
                <div data-testid="child-2">Second</div>
                <div data-testid="child-3">Third</div>
              </AuthGuard>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('child-1')).toBeInTheDocument();
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('child-2')).toBeInTheDocument();
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('child-3')).toBeInTheDocument();
        });
      });
    });
  });

  // ============================================================
  // SECTION 4: Account Page with ProtectedRoute Pattern
  // ============================================================
  describe('Account Page ProtectedRoute Pattern', () => {
    it('should redirect unauthenticated users to login from /account', async () => {
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
                    <div data-testid="account-page">Account Page</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LocationDisplay />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/login');
        expect(screen.getByTestId('search').textContent).toContain('returnUrl=%2Faccount');
      });
    });

    it('should render account page for authenticated users', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Authenticated User' },
      });

      render(
        <MemoryRouter initialEntries={['/account']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <div data-testid="account-page">Account Page</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('account-page')).toBeInTheDocument();
      });
    });

    it('should show loading state while checking auth for /account', () => {
      mockApiClient.checkSession.mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter initialEntries={['/account']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <div data-testid="account-page">Account Page</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // @ts-expect-error - jest-dom matchers
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('account-page')).toBeNull();
    });
  });

  // ============================================================
  // SECTION 5: Admin Page with ProtectedRoute Pattern
  // ============================================================
  describe('Admin Page ProtectedRoute Pattern', () => {
    it('should redirect unauthenticated users to login from /admin', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: false,
        user: null,
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <div data-testid="admin-page">Admin Page</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LocationDisplay />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/login');
        expect(screen.getByTestId('search').textContent).toContain('returnUrl=%2Fadmin');
      });
    });

    it('should render admin page for authenticated users', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Admin User' },
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <div data-testid="admin-page">Admin Page</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('admin-page')).toBeInTheDocument();
      });
    });

    it('should show loading state while checking auth for /admin', () => {
      mockApiClient.checkSession.mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <div data-testid="admin-page">Admin Page</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // @ts-expect-error - jest-dom matchers
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-page')).toBeNull();
    });
  });

  // ============================================================
  // SECTION 6: Navigation Auth-Aware Link Visibility
  // ============================================================
  describe('Navigation Auth-Aware Link Visibility', () => {
    describe('When Authenticated', () => {
      beforeEach(() => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'Test User' },
        });
      });

      it('should show Account and Admin links when authenticated', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // Account and Admin should be visible for authenticated users
          const accountLinks = screen.getAllByRole('link', { name: /account/i });
          expect(accountLinks.length).toBeGreaterThan(0);

          const adminLinks = screen.getAllByRole('link', { name: /admin/i });
          expect(adminLinks.length).toBeGreaterThan(0);
        });
      });

      it('should hide Login link when authenticated', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // Login should be hidden when authenticated
          expect(screen.queryByRole('link', { name: /^login$/i })).toBeNull();
        });
      });

      it('should show Logout button when authenticated', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          const logoutButton = screen.getByRole('button', { name: /logout/i });
          // @ts-expect-error - jest-dom matchers
          expect(logoutButton).toBeInTheDocument();
        });
      });

      it('should have correct href attributes for auth-required links', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          const accountLink = screen.getAllByRole('link', { name: /account/i })[0];
          expect(accountLink).toHaveAttribute('href', '/account');

          const adminLink = screen.getAllByRole('link', { name: /admin/i })[0];
          expect(adminLink).toHaveAttribute('href', '/admin');
        });
      });
    });

    describe('When Not Authenticated', () => {
      beforeEach(() => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });
      });

      it('should hide Account and Admin links when not authenticated', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // Account and Admin should be hidden for unauthenticated users
          expect(screen.queryByRole('link', { name: /account/i })).toBeNull();
          expect(screen.queryByRole('link', { name: /admin/i })).toBeNull();
        });
      });

      it('should show Login link when not authenticated', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          const loginLinks = screen.getAllByRole('link', { name: /login/i });
          expect(loginLinks.length).toBeGreaterThan(0);
          expect(loginLinks[0]).toHaveAttribute('href', '/login');
        });
      });

      it('should not show Logout button when not authenticated', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.queryByRole('button', { name: /logout/i })).toBeNull();
        });
      });
    });

    describe('Common Navigation Elements', () => {
      beforeEach(() => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });
      });

      it('should always show Home link', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          const homeLinks = screen.getAllByRole('link', { name: /^home$/i });
          expect(homeLinks.length).toBeGreaterThan(0);
        });
      });

      it('should always show Flipside link', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          const flipSideLinks = screen.getAllByRole('link', { name: /flipside/i });
          expect(flipSideLinks.length).toBeGreaterThan(0);
        });
      });

      it('should include Style Guide link in development/test environment', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // Style Guide should be visible in test environment
          const styleGuideLinks = screen.getAllByRole('link', { name: /style guide/i });
          expect(styleGuideLinks.length).toBeGreaterThan(0);
        });
      });

      it('should be desktop-only (mobile uses BottomTabBar)', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        // Navigation is desktop-only - uses hidden md:flex classes
        // Mobile navigation is handled by BottomTabBar component
        const nav = document.querySelector('nav');
        expect(nav).toHaveClass('hidden');
        expect(nav).toHaveClass('md:flex');
      });

      it('should show Clack Track brand link', async () => {
        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByText('Clack Track')).toBeInTheDocument();
        });
      });
    });

    describe('Logout Functionality', () => {
      it('should call logout when Logout button is clicked', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'Test User' },
        });
        mockApiClient.logout.mockResolvedValue({
          success: true,
          message: 'Logged out',
        });

        render(
          <MemoryRouter>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          const logoutButton = screen.getByRole('button', { name: /logout/i });
          fireEvent.click(logoutButton);
        });

        await waitFor(() => {
          expect(mockApiClient.logout).toHaveBeenCalled();
        });
      });
    });
  });

  // ============================================================
  // SECTION 7: Integration Scenarios
  // ============================================================
  describe('Integration Scenarios', () => {
    describe('Complete Auth Flow', () => {
      it('should handle session check failure gracefully', async () => {
        mockApiClient.checkSession.mockRejectedValue(new Error('Network error'));

        render(
          <MemoryRouter initialEntries={['/account']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <div>Account</div>
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LocationDisplay />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        // On error, should redirect to login
        await waitFor(() => {
          expect(screen.getByTestId('pathname').textContent).toBe('/login');
        });
      });

      it('should work with AuthGuard inside ProtectedRoute', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'Test User' },
        });

        render(
          <MemoryRouter initialEntries={['/dashboard']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <div data-testid="dashboard">
                        <h1>Dashboard</h1>
                        <AuthGuard require="admin" fallback={<span>No admin access</span>}>
                          <div data-testid="admin-panel">Admin Panel</div>
                        </AuthGuard>
                      </div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('dashboard')).toBeInTheDocument();
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('admin-panel')).toBeInTheDocument();
        });
      });
    });

    describe('AuthContext Provider Requirement', () => {
      it('should throw when ProtectedRoute is used outside AuthProvider', () => {
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
                      <div>Content</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </MemoryRouter>
          );
        }).toThrow('useAuth must be used within an AuthProvider');

        console.error = originalError;
      });

      it('should throw when AuthGuard is used outside AuthProvider', () => {
        const originalError = console.error;
        console.error = jest.fn();

        expect(() => {
          render(
            <MemoryRouter>
              <AuthGuard>
                <div>Content</div>
              </AuthGuard>
            </MemoryRouter>
          );
        }).toThrow('useAuth must be used within an AuthProvider');

        console.error = originalError;
      });
    });

    describe('Multiple Protected Routes', () => {
      it('should protect multiple routes independently', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: true,
          user: { name: 'Test User' },
        });

        // Test account route
        const { unmount } = render(
          <MemoryRouter initialEntries={['/account']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <div data-testid="account-page">Account</div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <div data-testid="admin-page">Admin</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('account-page')).toBeInTheDocument();
        });

        unmount();

        // Test admin route independently
        render(
          <MemoryRouter initialEntries={['/admin']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <div data-testid="account-page">Account</div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <div data-testid="admin-page">Admin</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId('admin-page')).toBeInTheDocument();
        });
      });

      it('should redirect both routes when unauthenticated', async () => {
        mockApiClient.checkSession.mockResolvedValue({
          authenticated: false,
          user: null,
        });

        // Test account route redirects
        const { unmount } = render(
          <MemoryRouter initialEntries={['/account']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <div>Account</div>
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LocationDisplay />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('pathname').textContent).toBe('/login');
          expect(screen.getByTestId('search').textContent).toContain('returnUrl=%2Faccount');
        });

        unmount();

        // Test admin route redirects
        render(
          <MemoryRouter initialEntries={['/admin']}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <div>Admin</div>
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LocationDisplay />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('pathname').textContent).toBe('/login');
          expect(screen.getByTestId('search').textContent).toContain('returnUrl=%2Fadmin');
        });
      });
    });
  });
});
