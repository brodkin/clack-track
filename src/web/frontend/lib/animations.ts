/**
 * Animation Utility Functions
 *
 * Provides haptic feedback, confetti animations, and split-flap display effects
 * for the Vestaboard web interface.
 */

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Haptic feedback intensity levels
 */
export type HapticType = 'light' | 'medium' | 'heavy';

/**
 * Configuration options for confetti animation
 */
export interface ConfettiConfig {
  /** Number of confetti particles to spawn (default: 50) */
  particleCount?: number;
  /** Spread angle in degrees (default: 70) */
  spread?: number;
  /** Starting X position as fraction of canvas width (0-1, default: 0.5) */
  originX?: number;
  /** Starting Y position as fraction of canvas height (0-1, default: 0.5) */
  originY?: number;
  /** Initial velocity (default: 30) */
  velocity?: number;
  /** Gravity acceleration (default: 0.5) */
  gravity?: number;
  /** Animation duration in milliseconds (default: 2000) */
  duration?: number;
  /** Custom colors array (default: CONFETTI_COLORS) */
  colors?: string[];
}

/**
 * Individual confetti particle state
 */
export interface Particle {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** X velocity */
  vx: number;
  /** Y velocity */
  vy: number;
  /** Particle color */
  color: string;
  /** Rotation angle in radians */
  rotation: number;
  /** Angular velocity */
  rotationSpeed: number;
  /** Particle size */
  size: number;
  /** Opacity (0-1) */
  opacity: number;
}

/**
 * Cleanup function returned by animation creators
 */
export type CleanupFunction = () => void;

// =============================================================================
// Constants
// =============================================================================

/**
 * Amber/gold/orange theme colors for confetti animation
 * Matches Vestaboard's characteristic amber display
 */
export const CONFETTI_COLORS: readonly string[] = [
  '#FFB800', // Amber (primary)
  '#FF8C00', // Dark orange
  '#FFD700', // Gold
  '#FFA500', // Orange
  '#FFCC00', // Yellow-gold
] as const;

/**
 * Vestaboard-style characters for split-flap spinning effect
 * Includes letters, numbers, and common symbols
 */
const FLIP_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&-+=:';

/**
 * Vibration patterns for different haptic intensities (in milliseconds)
 */
const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
};

/**
 * Success haptic pattern: double-tap for positive feedback
 */
const SUCCESS_HAPTIC_PATTERN = [15, 50, 15];

// =============================================================================
// Haptic Feedback Functions
// =============================================================================

/**
 * Check if the Vibration API is supported on the current device
 *
 * @returns True if navigator.vibrate is available
 */
function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback with specified intensity
 *
 * Gracefully degrades on devices without vibration support.
 *
 * @param type - Intensity level: 'light', 'medium', or 'heavy'
 *
 * @example
 * ```ts
 * // Light tap for button press
 * triggerHaptic('light');
 *
 * // Heavy feedback for errors
 * triggerHaptic('heavy');
 * ```
 */
export function triggerHaptic(type: HapticType): void {
  if (!isVibrationSupported()) {
    return;
  }

  const pattern = HAPTIC_PATTERNS[type];
  navigator.vibrate(pattern);
}

/**
 * Trigger success haptic pattern (double-tap)
 *
 * Used for positive actions like successful votes or confirmations.
 * Provides distinct tactile feedback to differentiate from single taps.
 *
 * @example
 * ```ts
 * // After successful vote submission
 * triggerSuccessHaptic();
 * ```
 */
export function triggerSuccessHaptic(): void {
  if (!isVibrationSupported()) {
    return;
  }

  navigator.vibrate(SUCCESS_HAPTIC_PATTERN);
}

// =============================================================================
// Confetti Animation Functions
// =============================================================================

/**
 * Create a single particle with random properties
 */
function createParticle(
  canvasWidth: number,
  canvasHeight: number,
  config: Required<ConfettiConfig>
): Particle {
  const angle = ((Math.random() * config.spread - config.spread / 2) * Math.PI) / 180;
  const velocity = config.velocity * (0.5 + Math.random() * 0.5);

  return {
    x: canvasWidth * config.originX,
    y: canvasHeight * config.originY,
    vx: Math.sin(angle) * velocity,
    vy: -Math.cos(angle) * velocity - Math.random() * 10,
    color: config.colors[Math.floor(Math.random() * config.colors.length)],
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.2,
    size: 8 + Math.random() * 8,
    opacity: 1,
  };
}

/**
 * Draw a single particle on the canvas
 */
function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle): void {
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.globalAlpha = particle.opacity;
  ctx.fillStyle = particle.color;

  // Draw a rounded rectangle shape
  const halfSize = particle.size / 2;
  ctx.beginPath();
  ctx.roundRect(-halfSize, -halfSize * 0.4, particle.size, particle.size * 0.4, 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Update particle physics for next frame
 */
function updateParticle(particle: Particle, gravity: number, deltaFade: number): void {
  particle.x += particle.vx;
  particle.y += particle.vy;
  particle.vy += gravity;
  particle.rotation += particle.rotationSpeed;
  particle.opacity = Math.max(0, particle.opacity - deltaFade);
}

/**
 * Create and run a confetti animation on a canvas element
 *
 * Uses requestAnimationFrame for smooth animation. Returns a cleanup function
 * for proper React integration (useEffect cleanup).
 *
 * @param canvas - HTML canvas element to render on
 * @param config - Optional configuration for the animation
 * @returns Cleanup function to stop the animation and clear the canvas
 *
 * @example
 * ```tsx
 * // React component usage
 * useEffect(() => {
 *   const canvas = canvasRef.current;
 *   if (!canvas) return;
 *
 *   const cleanup = createConfettiAnimation(canvas, {
 *     particleCount: 100,
 *     colors: CONFETTI_COLORS,
 *   });
 *
 *   return cleanup; // Proper cleanup on unmount
 * }, []);
 * ```
 */
export function createConfettiAnimation(
  canvas: HTMLCanvasElement,
  config: ConfettiConfig = {}
): CleanupFunction {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return () => {};
  }

  // Merge with defaults
  const fullConfig: Required<ConfettiConfig> = {
    particleCount: config.particleCount ?? 50,
    spread: config.spread ?? 70,
    originX: config.originX ?? 0.5,
    originY: config.originY ?? 0.5,
    velocity: config.velocity ?? 30,
    gravity: config.gravity ?? 0.5,
    duration: config.duration ?? 2000,
    colors: config.colors ?? [...CONFETTI_COLORS],
  };

  // Animation state
  const particles: Particle[] = [];
  let animationFrameId: number | null = null;
  let startTime: number | null = null;
  let isRunning = true;

  // Create initial particles
  for (let i = 0; i < fullConfig.particleCount; i++) {
    particles.push(createParticle(canvas.width, canvas.height, fullConfig));
  }

  // Calculate fade rate based on duration
  const fadeRate = 1 / (fullConfig.duration / 16.67); // Assuming ~60fps

  /**
   * Animation loop using requestAnimationFrame
   */
  function animate(timestamp: number): void {
    if (!isRunning) return;

    if (startTime === null) {
      startTime = timestamp;
    }

    const elapsed = timestamp - startTime;

    // Clear canvas
    ctx!.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    let activeParticles = 0;
    for (const particle of particles) {
      if (particle.opacity > 0) {
        updateParticle(particle, fullConfig.gravity, fadeRate);
        drawParticle(ctx!, particle);
        activeParticles++;
      }
    }

    // Continue animation if particles are still visible and within duration
    if (activeParticles > 0 && elapsed < fullConfig.duration) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      // Animation complete - clear canvas
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      isRunning = false;
    }
  }

  // Start animation
  animationFrameId = requestAnimationFrame(animate);

  // Return cleanup function
  return (): void => {
    isRunning = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}

// =============================================================================
// Split-Flap Animation Functions
// =============================================================================

/**
 * Calculate staggered delay for split-flap animation effect
 *
 * Creates a wave-like reveal pattern across the Vestaboard grid,
 * with delays increasing from top-left to bottom-right.
 *
 * @param row - Row index (0-5 for Vestaboard)
 * @param col - Column index (0-21 for Vestaboard)
 * @param baseDelay - Base delay in milliseconds (default: 20)
 * @param rowWeight - Weight multiplier for row position (default: 1.5)
 * @returns Delay in milliseconds for this cell's animation
 *
 * @example
 * ```tsx
 * // In VestaboardPreview component
 * {grid.map((row, rowIndex) =>
 *   row.map((code, colIndex) => (
 *     <Cell
 *       key={`${rowIndex}-${colIndex}`}
 *       style={{
 *         animationDelay: `${getSplitFlapDelay(rowIndex, colIndex)}ms`,
 *       }}
 *     />
 *   ))
 * )}
 * ```
 */
export function getSplitFlapDelay(
  row: number,
  col: number,
  baseDelay: number = 20,
  rowWeight: number = 1.5
): number {
  // Create diagonal wave effect from top-left
  // Rows have slightly more weight to create top-to-bottom cascade
  return Math.round((row * rowWeight + col) * baseDelay);
}

/**
 * Get a random character for split-flap spinning effect
 *
 * Returns a random uppercase letter, number, or symbol that would
 * appear on a Vestaboard during the flip animation between characters.
 *
 * @returns Single random character from Vestaboard character set
 *
 * @example
 * ```tsx
 * // During flip animation, show random characters
 * const [displayChar, setDisplayChar] = useState('A');
 *
 * useEffect(() => {
 *   const interval = setInterval(() => {
 *     setDisplayChar(getRandomFlipChar());
 *   }, 50);
 *   return () => clearInterval(interval);
 * }, []);
 * ```
 */
export function getRandomFlipChar(): string {
  return FLIP_CHARACTERS[Math.floor(Math.random() * FLIP_CHARACTERS.length)];
}
