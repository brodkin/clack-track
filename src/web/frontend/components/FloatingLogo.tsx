/**
 * FloatingLogo Component
 *
 * Sticky glassmorphism header with gradient brand text.
 * Displays 'Clack Track' with a red-yellow-red gradient and 'BY HOUSEBOY' byline.
 *
 * Features:
 * - Sticky positioning at top of viewport (participates in document flow)
 * - Glassmorphism: uniform bg, heavy blur, saturation boost, crisp border
 * - Gradient text treatment on logo
 * - Red-tinted byline with wide tracking
 * - Dark mode support
 * - Responsive typography
 */

import { cn } from '../lib/utils';

interface FloatingLogoProps {
  className?: string;
}

/**
 * FloatingLogo displays a sticky header with glassmorphism effect and gradient brand text.
 * The component sticks to the top of the viewport during scroll without blocking content flow.
 */
export function FloatingLogo({ className }: FloatingLogoProps) {
  return (
    <header
      data-testid="floating-logo"
      className={cn(
        // Sticky positioning (replaces fixed)
        'sticky top-0 w-full',
        // Z-index: above content (z-40), below modals (z-50)
        'z-40',
        // Glassmorphism: heavy blur + saturation boost + uniform background
        'backdrop-blur-2xl backdrop-saturate-150',
        'bg-white/60 dark:bg-gray-950/50',
        // Crisp border and red-tinted shadow
        'border-b border-red-200/30 dark:border-red-500/20',
        'shadow-[0_1px_20px_-6px_rgba(220,38,38,0.15)]',
        // Spacing
        'pt-6 pb-4 px-4',
        // Layout
        'flex justify-center items-center',
        className
      )}
    >
      <div className="text-center">
        {/* Main logo text with gradient */}
        <h1
          className={cn(
            // Typography
            'font-brush text-4xl md:text-5xl',
            // Gradient text: red-yellow-red
            'text-transparent bg-clip-text',
            'bg-gradient-to-r from-red-500 via-yellow-400 to-red-500'
          )}
        >
          Clack Track
        </h1>

        {/* Byline text with red tint */}
        <p
          className={cn(
            // Typography
            'font-display text-sm tracking-[0.3em] font-light',
            // Red-tinted color
            'text-red-800/60 dark:text-red-300/50',
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
