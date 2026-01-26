/**
 * Navigation Component
 *
 * Responsive navigation with mobile hamburger menu and desktop nav bar.
 * Conditionally shows/hides links based on authentication state.
 *
 * Features:
 * - Hides /admin and /account when not authenticated
 * - Shows /login when not authenticated
 * - Shows logout button and hides /login when authenticated
 * - Works in both mobile (Sheet) and desktop navigation
 * - No layout shift when auth state changes (consistent wrapper structure)
 *
 * Architecture:
 * - Single Responsibility: Navigation and auth-aware link visibility
 * - Dependency Inversion: Depends on AuthContext abstraction
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext.js';

interface NavigationProps {
  className?: string;
}

/**
 * Navigation link configuration
 */
interface NavLink {
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
const navLinks: NavLink[] = [
  { to: '/', label: 'Welcome' },
  { to: '/flipside', label: 'The Flip Side' },
  { to: '/account', label: 'Account', requiresAuth: true },
  { to: '/login', label: 'Login', hideWhenAuthenticated: true },
  { to: '/admin', label: 'Admin', requiresAuth: true },
  // Style Guide only visible in development (and test environments)
  ...(isDev ? [{ to: '/style-guide', label: 'Style Guide' }] : []),
];

/**
 * Filter navigation links based on authentication state
 */
function getVisibleLinks(links: NavLink[], isAuthenticated: boolean): NavLink[] {
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
 * Navigation provides mobile hamburger menu and desktop horizontal nav
 * with auth-aware link visibility
 */
export function Navigation({ className }: NavigationProps) {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, logout, isLoading } = useAuth();

  // Filter links based on auth state
  const visibleLinks = getVisibleLinks(navLinks, isAuthenticated);

  /**
   * Handle logout button click
   */
  const handleLogout = async () => {
    await logout();
    setOpen(false); // Close mobile menu if open
  };

  return (
    <nav className={cn('bg-gray-800 text-white shadow-lg', className)}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link to="/" className="text-xl font-bold hover:text-gray-300 transition-colors">
            Clack Track
          </Link>

          {/* Desktop Navigation */}
          <div data-testid="desktop-nav" className="hidden md:flex gap-6 items-center">
            {visibleLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              >
                {link.label}
              </Link>
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

          {/* Mobile Hamburger */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-gray-300"
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>Browse Clack Track</SheetDescription>
                </SheetHeader>
                <div data-testid="mobile-nav" className="flex flex-col gap-4 mt-6">
                  {visibleLinks.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className="text-lg hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                    >
                      {link.label}
                    </Link>
                  ))}
                  {/* Logout button - only show when authenticated */}
                  {isAuthenticated && !isLoading && (
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      className="justify-start text-lg hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
