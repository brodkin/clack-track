/**
 * useRequireAuth Hook
 *
 * Provides page-level authentication requirements with automatic redirect
 * handling and return URL preservation.
 *
 * Features:
 * - Returns { isLoading, isAuthenticated, user } for pages needing auth state
 * - Automatically redirects to /login if not authenticated (after loading complete)
 * - Preserves intended destination in returnUrl query param
 * - Works with or without ProtectedRoute wrapper
 * - Can disable redirect for pages that need auth state without protection
 *
 * Architecture:
 * - Single Responsibility: Manages page-level auth requirement checking
 * - Dependency Inversion: Uses AuthContext abstraction
 * - Open/Closed: Extensible via options without modifying core logic
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

/**
 * Options for useRequireAuth hook
 */
export interface UseRequireAuthOptions {
  /**
   * Whether to automatically redirect to login when not authenticated.
   * Set to false to just get auth state without redirect behavior.
   * @default true
   */
  redirect?: boolean;

  /**
   * Custom path to redirect to when not authenticated.
   * @default '/login'
   */
  redirectTo?: string;
}

/**
 * Return value from useRequireAuth hook
 */
export interface UseRequireAuthResult {
  /** True while session is being checked */
  isLoading: boolean;
  /** True if user is authenticated */
  isAuthenticated: boolean;
  /** User object if authenticated, null otherwise */
  user: { name: string } | null;
}

/**
 * Hook for page-level authentication requirements
 *
 * Usage in protected pages:
 * ```tsx
 * function AccountPage() {
 *   const { isLoading, isAuthenticated, user } = useRequireAuth();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!isAuthenticated) return null; // Redirect in progress
 *
 *   return <div>Welcome, {user?.name}</div>;
 * }
 * ```
 *
 * Usage without redirect (just auth state):
 * ```tsx
 * function OptionalAuthPage() {
 *   const { isAuthenticated, user } = useRequireAuth({ redirect: false });
 *
 *   return isAuthenticated
 *     ? <AuthenticatedView user={user} />
 *     : <GuestView />;
 * }
 * ```
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}): UseRequireAuthResult {
  const { redirect = true, redirectTo = '/login' } = options;

  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, isAuthenticated, user } = useAuth();

  useEffect(() => {
    // Only redirect after loading is complete and only if redirect is enabled
    if (!isLoading && !isAuthenticated && redirect) {
      // Preserve the intended destination in returnUrl query param
      const returnUrl = encodeURIComponent(location.pathname);
      navigate(`${redirectTo}?returnUrl=${returnUrl}`, { replace: true });
    }
  }, [isLoading, isAuthenticated, redirect, redirectTo, navigate, location.pathname]);

  return {
    isLoading,
    isAuthenticated,
    user,
  };
}
