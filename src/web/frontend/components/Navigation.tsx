/**
 * Navigation Component
 *
 * Desktop-only horizontal navigation bar with glass effect.
 * Mobile navigation is handled by BottomTabBar component.
 */

import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';

interface NavigationProps {
  className?: string;
}

// Check if we're in development mode
// Works in both Vite (NODE_ENV set by Vite) and Jest (NODE_ENV=test)
const isDev = process.env.NODE_ENV !== 'production';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/flipside', label: 'Flipside' },
  { to: '/account', label: 'Account' },
  // Style Guide only visible in development (and test environments)
  ...(isDev ? [{ to: '/style-guide', label: 'Style Guide' }] : []),
];

/**
 * Navigation provides desktop-only horizontal nav bar with glass effect.
 * Hidden on mobile (below md breakpoint) - BottomTabBar handles mobile navigation.
 */
export function Navigation({ className }: NavigationProps) {
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
          <div className="flex gap-6">
            {navLinks.map(link => (
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
          </div>
        </div>
      </div>
    </nav>
  );
}
