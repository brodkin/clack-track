/**
 * AuthGuard Component
 *
 * Conditionally renders UI elements based on authentication state.
 * Provides a declarative way to protect UI elements without full page redirects.
 *
 * Features:
 * - Renders children only when authenticated
 * - Shows fallback when not authenticated
 * - Supports role-based visibility (stubbed for future)
 * - No layout shift during auth state changes
 *
 * Architecture:
 * - Single Responsibility: Only handles conditional rendering based on auth
 * - Open/Closed: Extensible via require prop for future role checking
 * - Dependency Inversion: Depends on AuthContext abstraction
 */

import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext.js';

/**
 * Props for AuthGuard component
 */
export interface AuthGuardProps {
  /** Content to render when authenticated */
  children: ReactNode;
  /** Content to render when not authenticated (optional) */
  fallback?: ReactNode;
  /** Required role for access - stubbed for future implementation */
  require?: string;
}

/**
 * AuthGuard Component
 *
 * Conditionally renders children based on authentication state.
 * Uses a consistent wrapper element to prevent layout shift.
 *
 * @example Basic usage
 * ```tsx
 * <AuthGuard>
 *   <SecretContent />
 * </AuthGuard>
 * ```
 *
 * @example With fallback
 * ```tsx
 * <AuthGuard fallback={<LoginButton />}>
 *   <UserProfile />
 * </AuthGuard>
 * ```
 *
 * @example With role requirement (future)
 * ```tsx
 * <AuthGuard require="admin" fallback={<AccessDenied />}>
 *   <AdminPanel />
 * </AuthGuard>
 * ```
 */
export function AuthGuard({
  children,
  fallback,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  require: _require,
}: AuthGuardProps): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();

  // Determine what to render based on auth state
  // Note: role checking via `require` prop is stubbed for future role-based access
  const shouldRenderChildren = isAuthenticated && !isLoading;

  return (
    <div data-testid="auth-guard">
      {shouldRenderChildren ? children : isLoading ? null : fallback}
    </div>
  );
}

export default AuthGuard;
