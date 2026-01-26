/**
 * Navigation Component
 *
 * Desktop-only horizontal navigation bar with glass effect.
 * Mobile navigation is handled by BottomTabBar component.
 *
 * Features:
 * - Desktop only (hidden on mobile via md:hidden)
 * - Auth-aware: hides protected links when not authenticated
 * - Shows logout button when authenticated
 */

import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext.js';

interface NavigationProps {
  className?: string;
}

/**
 * Navigation link configuration
 */
interface NavLinkConfig {
  to: string;
  label: string;
  /** If true, only show when authenticated */
  requiresAuth?: boolean;
  /** If true, only show when NOT authenticated */
  hideWhenAuthenticated?: boolean;
}

// Check if we're in development mode
// Works in both Vite (NODE_ENV set by Vite) and Jest (NODE_ENV=test)
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Navigation links configuration
 * Public links are always visible, protected links depend on auth state
 */
const navLinks: NavLinkConfig[] = [
  { to: '/', label: 'Home' },
  { to: '/flipside', label: 'Flipside' },
  { to: '/account', label: 'Account', requiresAuth: true },
  { to: '/login', label: 'Login', hideWhenAuthenticated: true },
  // Style Guide only visible in development (and test environments)
  ...(isDev ? [{ to: '/style-guide', label: 'Style Guide' }] : []),
];

/**
 * Filter navigation links based on authentication state
 */
function getVisibleLinks(links: NavLinkConfig[], isAuthenticated: boolean): NavLinkConfig[] {
  return links.filter(link => {
    // Hide links that require auth when not authenticated
    if (link.requiresAuth && !isAuthenticated) {
      return false;
    }
    // Hide links that should be hidden when authenticated
    if (link.hideWhenAuthenticated && isAuthenticated) {
      return false;
    }
    return true;
  });
}

/**
 * Navigation provides desktop-only horizontal nav bar with glass effect.
 * Hidden on mobile (below md breakpoint) - BottomTabBar handles mobile navigation.
 */
export function Navigation({ className }: NavigationProps) {
  const { isAuthenticated, logout, isLoading } = useAuth();

  // Filter links based on auth state
  const visibleLinks = getVisibleLinks(navLinks, isAuthenticated);

  /**
   * Handle logout button click
   */
  const handleLogout = async () => {
    await logout();
  };

  return (
    <nav
      className={cn(
        // Hidden on mobile, flex on desktop
        'hidden md:flex',
        // Glass effect styling
        'bg-gray-900/80 backdrop-blur-md',
        'border-b border-white/10',
        'text-white shadow-lg',
        className
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <NavLink to="/" className="text-xl font-bold hover:text-gray-300 transition-colors">
            Clack Track
          </NavLink>

          {/* Desktop Navigation Links */}
          <div data-testid="desktop-nav" className="flex gap-6 items-center">
            {visibleLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-2 rounded-md transition-colors',
                    'hover:bg-white/10',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                    isActive
                      ? 'text-white font-medium bg-white/10'
                      : 'text-gray-300 hover:text-white'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            {/* Logout button - only show when authenticated */}
            {isAuthenticated && !isLoading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-white hover:text-gray-300 flex items-center gap-2"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
