/**
 * FloatingLogo Component
 *
 * Sticky glassmorphism header with gradient brand text.
 * Displays 'Clack Track' with a tiffany blue to medium-dark blue gradient
 * and 'BY HOUSEBOY' byline in complementary blue tones.
 *
 * Features:
 * - Sticky positioning at top of viewport (participates in document flow)
 * - Glassmorphism: uniform bg, heavy blur, saturation boost, crisp border
 * - Blue gradient text treatment on logo (tiffany blue to blue)
 * - Blue-tinted byline with wide tracking
 * - Dark mode support
 * - Responsive typography
 */

import { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

interface FloatingLogoProps {
  className?: string;
}

/**
 * Hook that shifts a gradient's background-position based on device tilt (gyroscope).
 * Falls back to a slow CSS animation on desktop / non-gyro devices.
 */
function useGyroGradient(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let hasGyro = false;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null) return;
      if (!hasGyro) {
        hasGyro = true;
        el.style.animationPlayState = 'paused';
      }
      // gamma: -90 to 90 (left/right tilt) → map to 0%–100% background-position
      const pct = ((e.gamma + 90) / 180) * 100;
      el.style.backgroundPosition = `${pct}% 50%`;
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [ref]);
}

/**
 * FloatingLogo displays a sticky header with glassmorphism effect and gradient brand text.
 * The component sticks to the top of the viewport during scroll without blocking content flow.
 */
export function FloatingLogo({ className }: FloatingLogoProps) {
  const h1Ref = useRef<HTMLHeadingElement>(null);
  useGyroGradient(h1Ref);

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
        // Crisp border and neutral shadow
        'border-b border-gray-300/30 dark:border-gray-500/20',
        'shadow-[0_1px_20px_-6px_rgba(128,128,128,0.18)]',
        // Spacing
        'pt-6 pb-4 px-4',
        // Layout
        'flex justify-center items-center',
        className
      )}
    >
      <div className="text-center">
        {/* Main logo text with glossy gradient */}
        <h1
          ref={h1Ref}
          className={cn(
            // Typography
            'font-brush text-4xl md:text-5xl leading-tight !mb-0',
            // Glossy gradient: wide with white highlight for shimmer
            'text-transparent bg-clip-text',
            'animate-glossy-shift'
          )}
          style={{
            backgroundImage:
              'linear-gradient(90deg, #2563eb 0%, #0abab5 20%, #60a5fa 40%, rgba(255,255,255,0.18) 50%, #60a5fa 60%, #0abab5 80%, #2563eb 100%)',
            backgroundSize: '300% 100%',
          }}
        >
          Clack Track
        </h1>

        {/* Byline text with gold tint */}
        <p
          className={cn(
            // Typography
            'font-display text-base tracking-[0.45em] font-light',
            // Gold-tinted color
            'text-amber-800/60 dark:text-amber-300/50',
            // Spacing
            'mt-0'
          )}
        >
          BY HOUSEBOY
        </p>
      </div>
    </header>
  );
}
