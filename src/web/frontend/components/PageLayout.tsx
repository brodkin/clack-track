/**
 * PageLayout Component
 *
 * Wrapper component with navigation and responsive container.
 * Integrates both desktop (Navigation) and mobile (BottomTabBar) navigation.
 */

import { Navigation } from './Navigation';
import { BottomTabBar } from './BottomTabBar';
import { cn } from '../lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageLayout wraps pages with navigation and consistent container.
 *
 * Layout structure:
 * - Navigation: Desktop only (hidden on mobile via md:flex)
 * - Main content: Bottom padding on mobile to prevent BottomTabBar overlap
 * - BottomTabBar: Mobile only (hidden on desktop via md:hidden)
 */
export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <main className={cn('container mx-auto px-4 py-8 pb-20 md:pb-0', className)}>
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
