/**
 * BottomTabBar Component
 *
 * iOS 26-style floating bottom tab bar with glass effect.
 * Provides navigation with haptic feedback and smooth transitions.
 *
 * Features:
 * - Floating pill shape with backdrop blur (glass effect)
 * - Active state: filled icon, visible label, scale effect
 * - Inactive state: outline icon, hidden label
 * - Safe area padding for notched devices
 * - Visible on all screen sizes
 * - Haptic feedback on tab switch
 * - Logout button when authenticated
 * - Auth-aware link visibility (Login, Admin, Account)
 * - Dev-only Style Guide link
 */

import { NavLink } from 'react-router-dom';
import { Home, Clock, Settings, User, LogIn, Palette, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { triggerHaptic } from '../lib/animations';
import { useAuth } from '../context/AuthContext.js';

interface BottomTabBarProps {
  className?: string;
}

interface TabConfig {
  to: string;
  label: string;
  icon: typeof Home;
  /** Use 'end' prop on NavLink for exact matching (/ route) */
  exact?: boolean;
  /** If true, only show when authenticated */
  requiresAuth?: boolean;
  /** If true, only show when NOT authenticated */
  hideWhenAuthenticated?: boolean;
}

/**
 * Get all navigation tabs including environment-aware ones
 */
function getAllTabs(): TabConfig[] {
  const baseTabs: TabConfig[] = [
    { to: '/', label: 'Home', icon: Home, exact: true },
    { to: '/flipside', label: 'History', icon: Clock },
    { to: '/account', label: 'Account', icon: User, requiresAuth: true },
    { to: '/admin', label: 'Admin', icon: Settings, requiresAuth: true },
    { to: '/login', label: 'Login', icon: LogIn, hideWhenAuthenticated: true },
  ];

  // Style Guide only visible in development (and test environments)
  // Use function to make it reactive to NODE_ENV changes (important for testing)
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    baseTabs.push({ to: '/style-guide', label: 'Style Guide', icon: Palette as typeof Home });
  }

  return baseTabs;
}

/**
 * BottomTabBar provides iOS 26-style floating navigation.
 * Visible on all screen sizes with complete navigation options.
 */
export function BottomTabBar({ className }: BottomTabBarProps) {
  const { isAuthenticated, logout, isLoading } = useAuth();

  // Get all tabs (including environment-specific ones)
  const allTabs = getAllTabs();

  // Filter tabs based on auth state
  const visibleTabs = allTabs.filter(tab => {
    // Hide tabs that require auth when not authenticated
    if (tab.requiresAuth && !isAuthenticated) {
      return false;
    }
    // Hide tabs that should be hidden when authenticated
    if (tab.hideWhenAuthenticated && isAuthenticated) {
      return false;
    }
    return true;
  });

  const handleTabClick = () => {
    triggerHaptic('light');
  };

  const handleLogout = async () => {
    triggerHaptic('light');
    await logout();
  };

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        // Fixed positioning - floating at bottom center
        'fixed bottom-4 left-1/2 -translate-x-1/2',
        // Z-index to stay above content
        'z-50',
        // Pill shape
        'rounded-full',
        // Glass effect with backdrop blur (matches header treatment)
        'bg-white/80 dark:bg-gray-900/80',
        'backdrop-blur-2xl backdrop-saturate-150',
        // Border for definition
        'border border-gray-200/50 dark:border-gray-700/50',
        // Shadow for depth
        'shadow-lg shadow-black/10',
        // Padding
        'px-2 py-1',
        // Safe area for notched devices
        'safe-area-bottom',
        // Visible on all screen sizes
        // Flex layout for tabs
        'flex items-center gap-1',
        className
      )}
    >
      {visibleTabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.exact}
          onClick={handleTabClick}
          className={({ isActive }) =>
            cn(
              // Base styles - flex column for icon + label
              'flex flex-col items-center justify-center',
              // Minimum touch target (44px = min-h-11, min-w-11)
              'min-h-11 min-w-11',
              // Padding for comfortable touch
              'px-4 py-2',
              // Rounded for pill aesthetic
              'rounded-full',
              // Smooth transitions
              'transition-all duration-200',
              // Focus visible state for accessibility
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
              // Active vs inactive styling
              isActive
                ? [
                    // Active: brand-red color, scale up
                    'text-red-600 dark:text-red-400',
                    'bg-red-50 dark:bg-red-900/20',
                    'scale-105',
                  ]
                : [
                    // Inactive: gray color
                    'text-gray-500 dark:text-gray-400',
                    'hover:text-gray-700 dark:hover:text-gray-300',
                    'hover:bg-gray-100 dark:hover:bg-gray-800/50',
                  ]
            )
          }
        >
          {({ isActive }) => (
            <>
              <tab.icon
                className={cn(
                  'h-5 w-5',
                  // Filled vs outline based on active state
                  // Note: Lucide icons don't have fill variants, but we can use strokeWidth
                  isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'
                )}
              />
              <span
                className={cn(
                  'text-xs font-medium mt-0.5',
                  // Show label when active, hide when inactive
                  isActive ? 'opacity-100' : 'opacity-0 sr-only'
                )}
              >
                {tab.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
      {/* Logout button - only show when authenticated */}
      {isAuthenticated && !isLoading && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            // Match tab styling
            'flex flex-col items-center justify-center',
            'min-h-11 min-w-11',
            'px-4 py-2',
            'rounded-full',
            'transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
            // Logout styling
            'text-gray-500 dark:text-gray-400',
            'hover:text-gray-700 dark:hover:text-gray-300',
            'hover:bg-gray-100 dark:hover:bg-gray-800/50'
          )}
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5 stroke-[1.5]" />
          <span className="text-xs font-medium mt-0.5 opacity-0 sr-only">Logout</span>
        </Button>
      )}
    </nav>
  );
}
