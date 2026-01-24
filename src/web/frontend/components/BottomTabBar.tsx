/**
 * BottomTabBar Component
 *
 * iOS 26-style floating bottom tab bar with glass effect.
 * Provides mobile navigation with haptic feedback and smooth transitions.
 *
 * Features:
 * - Floating pill shape with backdrop blur (glass effect)
 * - Active state: filled icon, visible label, scale effect
 * - Inactive state: outline icon, hidden label
 * - Safe area padding for notched devices
 * - Hidden on desktop (md:hidden)
 * - Haptic feedback on tab switch
 */

import { NavLink } from 'react-router-dom';
import { Home, Clock, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { triggerHaptic } from '../lib/animations';

interface BottomTabBarProps {
  className?: string;
}

interface TabConfig {
  to: string;
  label: string;
  icon: typeof Home;
  /** Use 'end' prop on NavLink for exact matching (/ route) */
  exact?: boolean;
}

const tabs: TabConfig[] = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  { to: '/flipside', label: 'History', icon: Clock },
  { to: '/account', label: 'Account', icon: User },
];

/**
 * BottomTabBar provides iOS 26-style floating navigation for mobile devices.
 * Hidden on desktop (md breakpoint and above).
 */
export function BottomTabBar({ className }: BottomTabBarProps) {
  const handleTabClick = () => {
    triggerHaptic('light');
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
        // Glass effect with backdrop blur
        'bg-white/80 dark:bg-gray-900/80',
        'backdrop-blur-xl',
        // Border for definition
        'border border-gray-200/50 dark:border-gray-700/50',
        // Shadow for depth
        'shadow-lg shadow-black/10',
        // Padding
        'px-2 py-1',
        // Safe area for notched devices
        'safe-area-bottom',
        // Hide on desktop - mobile only
        'md:hidden',
        // Flex layout for tabs
        'flex items-center gap-1',
        className
      )}
    >
      {tabs.map(tab => (
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
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
              // Active vs inactive styling
              isActive
                ? [
                    // Active: amber color, scale up
                    'text-amber-600 dark:text-amber-400',
                    'bg-amber-50 dark:bg-amber-900/30',
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
    </nav>
  );
}
