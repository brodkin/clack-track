/**
 * Confetti Component
 *
 * Canvas-based confetti animation overlay for celebration effects.
 * Uses animation utilities for particle physics and rendering.
 */

import { useRef, useEffect, useCallback } from 'react';
import { createConfettiAnimation, CONFETTI_COLORS, type CleanupFunction } from '../lib/animations';

/**
 * Props for the Confetti component
 */
export interface ConfettiProps {
  /** When true, triggers the confetti animation */
  active: boolean;
  /** Callback fired when animation completes */
  onComplete?: () => void;
}

/** Animation duration in milliseconds (matches animations.ts default + buffer) */
const ANIMATION_DURATION = 2500;

/**
 * Confetti renders a full-screen canvas overlay with particle animation.
 *
 * The animation bursts particles upward with gravity, then fades them out.
 * Canvas automatically resizes on window resize and cleans up on unmount.
 *
 * @example
 * ```tsx
 * const [showConfetti, setShowConfetti] = useState(false);
 *
 * <Confetti
 *   active={showConfetti}
 *   onComplete={() => setShowConfetti(false)}
 * />
 * ```
 */
export function Confetti({ active, onComplete }: ConfettiProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupRef = useRef<CleanupFunction | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteCalledRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref current to avoid stale closures
  // This effect runs synchronously before paint, so the ref is always up-to-date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  /**
   * Handle canvas resize on window resize
   */
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }, []);

  /**
   * Cleanup all animation resources
   */
  const cleanupAnimation = useCallback(() => {
    // Cancel any running animation
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Main effect: start/stop animation based on active prop
  useEffect(() => {
    if (!active) {
      cleanupAnimation();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size to viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Reset completion flag for new animation
    onCompleteCalledRef.current = false;

    // Start confetti animation with amber/gold theme
    cleanupRef.current = createConfettiAnimation(canvas, {
      particleCount: 60,
      spread: 90,
      originX: 0.5,
      originY: 0.6,
      velocity: 35,
      gravity: 0.6,
      duration: ANIMATION_DURATION,
      colors: [...CONFETTI_COLORS],
    });

    // Set timeout to end animation
    timeoutRef.current = setTimeout(() => {
      // Guard against double-firing
      if (onCompleteCalledRef.current) return;
      onCompleteCalledRef.current = true;

      cleanupAnimation();
      onCompleteRef.current?.();
    }, ANIMATION_DURATION);

    // Cleanup on unmount or when active changes
    return () => {
      cleanupAnimation();
    };
  }, [active, cleanupAnimation]);

  // Handle window resize
  useEffect(() => {
    if (!active) return;

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [active, handleResize]);

  // Don't render canvas when not active
  if (!active) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
