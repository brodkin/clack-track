/**
 * useRequireAuth Hook Tests
 *
 * Tests for the useRequireAuth hook that provides page-level auth requirements
 * with automatic redirect handling and return URL preservation.
 *
 * @jest-environment jsdom
 */

/// <reference types="@testing-library/jest-dom" />
import { renderHook, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import { useRequireAuth } from '@/web/frontend/hooks/useRequireAuth';
import * as apiClient from '@/web/frontend/services/apiClient';

// Mock the API client
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    checkSession: jest.fn(),
  },
}));

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>;

/**
 * Helper component to capture current location for redirect testing
 */
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

describe('useRequireAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: unauthenticated state
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: false,
      user: null,
    });
  });

  /**
   * Wrapper that provides AuthProvider and Router context
   */
  const createWrapper = (initialRoute = '/protected') => {
    function TestWrapper({ children }: { children: React.ReactNode }) {
      return (
        <MemoryRouter initialEntries={[initialRoute]}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <>
                    {children}
                    <LocationDisplay />
                  </>
                }
              />
              <Route
                path="/login"
                element={
                  <>
                    <div>Login Page</div>
                    <LocationDisplay />
                  </>
                }
              />
              <Route
                path="/account"
                element={
                  <>
                    {children}
                    <LocationDisplay />
                  </>
                }
              />
              <Route
                path="/admin"
                element={
                  <>
                    {children}
                    <LocationDisplay />
                  </>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );
    }
    return TestWrapper;
  };

  describe('Return Value Structure', () => {
    it('should return isLoading, isAuthenticated, and user properties', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      // Check that all expected properties exist
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('user');
    });

    it('should return isLoading=true initially during session check', () => {
      // Make the session check hang to observe loading state
      mockApiClient.checkSession.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('should return isLoading=false after session check completes', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should return isAuthenticated=false when user is not logged in', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should return isAuthenticated=true when user is logged in', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should return user=null when not authenticated', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('should return user object when authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual({ name: 'Test User' });
    });
  });

  describe('Automatic Redirect Behavior', () => {
    it('should redirect to /login when not authenticated after loading completes', async () => {
      const wrapper = createWrapper('/protected');
      renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        const location = document.querySelector('[data-testid="location"]');
        expect(location?.textContent).toContain('/login');
      });
    });

    it('should NOT redirect while still loading', async () => {
      // Make the session check hang
      let resolveCheck: (value: { authenticated: boolean; user: null }) => void;
      mockApiClient.checkSession.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveCheck = resolve;
          })
      );

      const wrapper = createWrapper('/protected');
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      // Should still be loading and not redirected
      expect(result.current.isLoading).toBe(true);

      // Location should still be /protected while loading
      const location = document.querySelector('[data-testid="location"]');
      expect(location?.textContent).toBe('/protected');

      // Now resolve the check
      await act(async () => {
        resolveCheck!({ authenticated: false, user: null });
      });

      // Now it should redirect
      await waitFor(() => {
        const location = document.querySelector('[data-testid="location"]');
        expect(location?.textContent).toContain('/login');
      });
    });

    it('should NOT redirect when user is authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      const wrapper = createWrapper('/protected');
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still be on /protected, not redirected
      const location = document.querySelector('[data-testid="location"]');
      expect(location?.textContent).toBe('/protected');
    });
  });

  describe('Return URL Preservation', () => {
    it('should include current path as returnUrl query param when redirecting', async () => {
      const wrapper = createWrapper('/protected');
      renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        const location = document.querySelector('[data-testid="location"]');
        expect(location?.textContent).toContain('/login');
        expect(location?.textContent).toContain('returnUrl=%2Fprotected');
      });
    });

    it('should preserve returnUrl for /account page', async () => {
      const wrapper = createWrapper('/account');
      renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        const location = document.querySelector('[data-testid="location"]');
        expect(location?.textContent).toContain('/login');
        expect(location?.textContent).toContain('returnUrl=%2Faccount');
      });
    });

    it('should preserve returnUrl for /admin page', async () => {
      const wrapper = createWrapper('/admin');
      renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        const location = document.querySelector('[data-testid="location"]');
        expect(location?.textContent).toContain('/login');
        expect(location?.textContent).toContain('returnUrl=%2Fadmin');
      });
    });
  });

  describe('Works Without ProtectedRoute Wrapper', () => {
    it('should function independently without ProtectedRoute component', async () => {
      // This test verifies the hook can be used standalone in pages
      // that need auth state without the full ProtectedRoute wrapper
      const wrapper = createWrapper('/protected');
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Hook should work and provide auth state
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should allow pages to check auth state without automatic redirect when disabled', async () => {
      // When redirect is disabled, hook just returns auth state
      const wrapper = createWrapper('/protected');
      const { result } = renderHook(() => useRequireAuth({ redirect: false }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should return auth state
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();

      // But should NOT have redirected
      const location = document.querySelector('[data-testid="location"]');
      expect(location?.textContent).toBe('/protected');
    });
  });

  describe('Context Requirement', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useRequireAuth(), {
          wrapper: ({ children }) => (
            <MemoryRouter initialEntries={['/protected']}>
              <Routes>
                <Route path="/protected" element={<>{children}</>} />
              </Routes>
            </MemoryRouter>
          ),
        });
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });
  });

  describe('Custom Redirect Path', () => {
    it('should allow customizing the redirect path', async () => {
      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <>
                    {children}
                    <LocationDisplay />
                  </>
                }
              />
              <Route
                path="/custom-login"
                element={
                  <>
                    <div>Custom Login</div>
                    <LocationDisplay />
                  </>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      renderHook(() => useRequireAuth({ redirectTo: '/custom-login' }), {
        wrapper: customWrapper,
      });

      await waitFor(() => {
        const location = document.querySelector('[data-testid="location"]');
        expect(location?.textContent).toContain('/custom-login');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle session check failure gracefully', async () => {
      mockApiClient.checkSession.mockRejectedValue(new Error('Network error'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // On error, should treat as unauthenticated
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should maintain stable references across re-renders', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      const wrapper = createWrapper();
      const { result, rerender } = renderHook(() => useRequireAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstUser = result.current.user;

      // Re-render the hook
      rerender();

      // User reference should remain the same
      expect(result.current.user).toBe(firstUser);
    });
  });
});
