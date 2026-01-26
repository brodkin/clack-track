/**
 * PageLayout Component
 *
 * Wrapper component with floating logo and bottom tab navigation.
 * Features responsive spacing for FloatingLogo and BottomTabBar.
 */

import { FloatingLogo } from './FloatingLogo';
import { BottomTabBar } from './BottomTabBar';
import { cn } from '../lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageLayout wraps pages with consistent navigation and spacing.
 *
 * Layout structure:
 * - FloatingLogo: Fixed at top with gradient blur effect
 * - Main content: Top padding for logo, bottom padding for tab bar
 * - BottomTabBar: Fixed at bottom for all screen sizes
 */
export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <FloatingLogo />
      <main className={cn('container mx-auto px-4 py-8 pt-32 pb-20 md:pb-0', className)}>
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
