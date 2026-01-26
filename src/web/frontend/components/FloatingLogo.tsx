/**
 * FloatingLogo Component
 *
 * Fixed floating logo at the top of the screen with gradient blur effect.
 * Displays 'Clack Track' in brush script with 'BY HOUSEBOY' byline.
 *
 * Features:
 * - Fixed positioning at top of viewport
 * - Gradient blur effect fading into page content
 * - Dark mode support
 * - Responsive typography
 * - Non-blocking pointer events (allows clicks through to content below)
 */

import { cn } from '../lib/utils';

interface FloatingLogoProps {
  className?: string;
}

/**
 * FloatingLogo displays a fixed header with brand text and gradient fade effect.
 * The component is positioned above page content with a blur overlay.
 */
export function FloatingLogo({ className }: FloatingLogoProps) {
  return (
    <header
      data-testid="floating-logo"
      className={cn(
        // Fixed positioning
        'fixed top-0 left-0 w-full',
        // Z-index: above content (z-40), below modals (z-50)
        'z-40',
        // Gradient background with blur
        'bg-gradient-to-b from-gray-50 via-gray-50/90 to-transparent',
        'dark:from-gray-900 dark:via-gray-900/90 dark:to-transparent',
        'backdrop-blur-md',
        // Spacing
        'py-6 px-4',
        // Layout
        'flex justify-center items-center',
        // Pointer events - allow clicks through to content below
        'pointer-events-none',
        className
      )}
    >
      {/* Text container with pointer events enabled */}
      <div className="pointer-events-auto text-center">
        {/* Main logo text */}
        <h1
          className={cn(
            // Typography
            'font-brush text-4xl md:text-5xl',
            // Color
            'text-gray-900 dark:text-white'
          )}
        >
          Clack Track
        </h1>

        {/* Byline text */}
        <p
          className={cn(
            // Typography
            'font-display text-sm tracking-widest font-light',
            // Color
            'text-gray-600 dark:text-gray-400',
            // Spacing
            'mt-1'
          )}
        >
          BY HOUSEBOY
        </p>
      </div>
    </header>
  );
}
