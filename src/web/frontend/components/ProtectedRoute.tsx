/**
 * ProtectedRoute Component
 *
 * Reusable route wrapper that checks authentication before rendering children.
 * Provides three states: loading, redirect, and render.
 *
 * Architecture:
 * - Single Responsibility: Manages only route protection logic
 * - Dependency Inversion: Depends on AuthContext abstraction
 * - Open/Closed: Extensible for different redirect strategies
 *
 * Usage:
 * ```tsx
 * <Route
 *   path="/account"
 *   element={
 *     <ProtectedRoute>
 *       <Account />
 *     </ProtectedRoute>
 *   }
 * />
 * ```
 */

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

/**
 * Props for ProtectedRoute component
 */
interface ProtectedRouteProps {
  /**
   * Children to render when authenticated
   */
  children: ReactNode;
}

/**
 * Loading component displayed while checking authentication
 */
function AuthLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-8 h-8 border-4 border-gray-300 dark:border-gray-700 border-t-amber-400 rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
        <span className="text-gray-500 dark:text-gray-400 text-sm">Loading...</span>
      </div>
    </div>
  );
}

/**
 * ProtectedRoute Component
 *
 * Wraps route elements to enforce authentication.
 *
 * States:
 * 1. Loading - Shows spinner while checking auth (isLoading from AuthContext)
 * 2. Redirect - Navigates to /login with returnUrl if not authenticated
 * 3. Render - Displays children when authenticated
 *
 * @param props - Component props containing children to protect
 * @returns Protected children or loading/redirect
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // State 1: Loading - Show spinner while checking authentication
  if (isLoading) {
    return <AuthLoading />;
  }

  // State 2: Redirect - Navigate to login with return URL if not authenticated
  if (!isAuthenticated) {
    // Encode the current path and search params as return URL
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  // State 3: Render - Display protected children when authenticated
  return <>{children}</>;
}
