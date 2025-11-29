/**
 * PageLayout Component
 *
 * Wrapper component with navigation and responsive container
 */

import { Navigation } from './Navigation';
import { cn } from '../lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageLayout wraps pages with navigation and consistent container
 */
export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <main className={cn('container mx-auto px-4 py-8', className)}>{children}</main>
    </div>
  );
}
