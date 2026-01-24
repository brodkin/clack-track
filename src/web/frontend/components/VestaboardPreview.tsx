/**
 * VestaboardPreview Component
 *
 * Displays Vestaboard content in a 6x22 character grid with split-flap aesthetic
 * Includes split-flap animation when content changes
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '../lib/utils';
import { getSplitFlapDelay, getRandomFlipChar } from '../lib/animations';

/**
 * Character code to display character mapping
 * Based on Vestaboard's character set
 */
const CHAR_MAP: Record<number, string> = {
  0: ' ',
  1: 'A',
  2: 'B',
  3: 'C',
  4: 'D',
  5: 'E',
  6: 'F',
  7: 'G',
  8: 'H',
  9: 'I',
  10: 'J',
  11: 'K',
  12: 'L',
  13: 'M',
  14: 'N',
  15: 'O',
  16: 'P',
  17: 'Q',
  18: 'R',
  19: 'S',
  20: 'T',
  21: 'U',
  22: 'V',
  23: 'W',
  24: 'X',
  25: 'Y',
  26: 'Z',
  27: '1',
  28: '2',
  29: '3',
  30: '4',
  31: '5',
  32: '6',
  33: '7',
  34: '8',
  35: '9',
  36: '0',
  37: '!',
  38: '@',
  39: '#',
  40: '$',
  41: '(',
  42: ')',
  44: '-',
  46: '+',
  47: '&',
  48: '=',
  49: ';',
  50: ':',
  52: "'",
  53: '"',
  54: '%',
  55: ',',
  56: '.',
  59: '/',
  60: '?',
  62: '°',
};

/**
 * Color tile codes (63-69) map to background colors
 * These are solid colored tiles on the physical Vestaboard
 * Code 69 is model-dependent: white on black boards, black on white boards
 */
const COLOR_TILE_MAP: Record<number, string> = {
  63: '#c23a3a', // red - desaturated for realistic print appearance
  64: '#d4804a', // orange
  65: '#d4c94a', // yellow
  66: '#4aad4a', // green
  67: '#4a6aad', // blue
  68: '#8a4aad', // violet
  // 69 is handled separately based on model
};

/**
 * Check if a character code is a color tile (63-69)
 */
function isColorTile(code: number): boolean {
  return code >= 63 && code <= 69;
}

/**
 * Get the background color for a color tile code
 * Code 69 returns white for black model, black for white model
 */
function getColorTileBackground(code: number, model: VestaboardModel): string | null {
  if (code === 69) {
    return model === 'white' ? '#000000' : '#ffffff';
  }
  return COLOR_TILE_MAP[code] || null;
}

/**
 * Vestaboard model type - determines the color scheme
 * - 'black': Off-black board with near-black flaps and white/amber text
 * - 'white': Off-white board with near-white flaps and dark text
 */
type VestaboardModel = 'black' | 'white';

interface VestaboardPreviewProps {
  content: number[][];
  className?: string;
  /** Vestaboard hardware model - affects color scheme. Defaults to 'black' */
  model?: VestaboardModel;
}

/**
 * Cell animation state for split-flap effect
 */
interface CellAnimationState {
  isAnimating: boolean;
  displayChar: string;
  flipCount: number;
}

/**
 * Base flip duration in milliseconds per intermediate character
 */
const FLIP_DURATION = 100;

/**
 * Number of intermediate characters to show during flip
 */
const FLIP_COUNT = 3;

/**
 * Create initial animation state for all cells (no animation)
 */
function createInitialAnimationState(): CellAnimationState[][] {
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 22 }, () => ({
      isAnimating: false,
      displayChar: '',
      flipCount: 0,
    }))
  );
}

/**
 * VestaboardPreview displays a 6x22 grid of characters with split-flap styling
 * Animates cells with split-flap effect when content changes
 */
export function VestaboardPreview({ content, className, model = 'black' }: VestaboardPreviewProps) {
  // Track previous content to detect changes
  const previousContentRef = useRef<number[][] | null>(null);
  const isFirstRenderRef = useRef(true);

  // Animation state for each cell
  const [animationState, setAnimationState] = useState<CellAnimationState[][]>(
    createInitialAnimationState
  );

  // Ensure we always have 6 rows with 22 cells each (memoized to prevent unnecessary updates)
  const rows = useMemo(() => {
    return Array.from({ length: 6 }, (_, rowIndex) => {
      const row = content[rowIndex] || [];
      return Array.from({ length: 22 }, (_, colIndex) => row[colIndex] ?? 0);
    });
  }, [content]);

  // Handle content changes and trigger animations
  useEffect(() => {
    // Skip animation on first render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousContentRef.current = rows.map(row => [...row]);
      return;
    }

    const previousContent = previousContentRef.current;
    if (!previousContent) {
      previousContentRef.current = rows.map(row => [...row]);
      return;
    }

    // Find cells that changed
    const changedCells: Array<{ row: number; col: number; newCode: number }> = [];
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 22; col++) {
        const prevCode = previousContent[row]?.[col] ?? 0;
        const newCode = rows[row][col];
        if (prevCode !== newCode) {
          changedCells.push({ row, col, newCode });
        }
      }
    }

    // No changes, nothing to animate
    if (changedCells.length === 0) {
      return;
    }

    // Store active timers for cleanup
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Start animations for changed cells
    setAnimationState(prev => {
      const newState = prev.map(row => row.map(cell => ({ ...cell })));
      for (const { row, col } of changedCells) {
        newState[row][col] = {
          isAnimating: true,
          displayChar: getRandomFlipChar(),
          flipCount: 0,
        };
      }
      return newState;
    });

    // Schedule flip animations for each changed cell
    for (const { row, col } of changedCells) {
      const delay = getSplitFlapDelay(row, col);

      // Schedule intermediate flips
      for (let flip = 1; flip <= FLIP_COUNT; flip++) {
        const flipDelay = delay + flip * FLIP_DURATION;
        const timer = setTimeout(() => {
          setAnimationState(prev => {
            const newState = prev.map(r => r.map(c => ({ ...c })));
            if (flip < FLIP_COUNT) {
              // Show random character during intermediate flips
              newState[row][col] = {
                isAnimating: true,
                displayChar: getRandomFlipChar(),
                flipCount: flip,
              };
            } else {
              // Final flip - show actual character and end animation
              newState[row][col] = {
                isAnimating: false,
                displayChar: '',
                flipCount: 0,
              };
            }
            return newState;
          });
        }, flipDelay);
        timers.push(timer);
      }
    }

    // Update previous content reference
    previousContentRef.current = rows.map(row => [...row]);

    // Cleanup timers on unmount or content change
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [rows]); // Trigger on content change (rows is memoized from content)

  // Color schemes based on Vestaboard hardware model
  const isWhiteModel = model === 'white';

  return (
    <div
      data-testid="vestaboard"
      role="region"
      aria-label="Vestaboard display showing current content"
      className={cn(
        'w-full max-w-4xl mx-auto p-4 rounded-lg shadow-2xl',
        isWhiteModel ? 'bg-[#f5f5f5]' : 'bg-[#0a0a0a]',
        className
      )}
    >
      <div className="space-y-1">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            data-testid={`vestaboard-row-${rowIndex}`}
            className="flex gap-1 justify-center"
          >
            {row.map((charCode, colIndex) => {
              const colorTileBg = isColorTile(charCode)
                ? getColorTileBackground(charCode, model)
                : null;

              const cellAnimation = animationState[rowIndex]?.[colIndex];
              const isAnimating = cellAnimation?.isAnimating ?? false;
              const displayChar = cellAnimation?.displayChar ?? '';

              // Determine what character to show
              let charToShow: string;
              if (colorTileBg) {
                charToShow = ''; // Color tiles never show characters
              } else if (isAnimating && displayChar) {
                charToShow = displayChar; // Show random flip character
              } else {
                charToShow = CHAR_MAP[charCode] || ' '; // Show final character
              }

              // Calculate animation delay for staggered effect
              const animationDelay = isAnimating ? `${getSplitFlapDelay(rowIndex, colIndex)}ms` : '';

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  data-testid={`vestaboard-cell-${rowIndex}-${colIndex}`}
                  data-char-code={charCode}
                  className={cn(
                    'flex items-center justify-center',
                    'w-6 h-8 sm:w-8 sm:h-10 md:w-10 md:h-12',
                    // Use color tile background if applicable, otherwise default cell styling
                    colorTileBg
                      ? `bg-[${colorTileBg}]`
                      : isWhiteModel
                        ? 'bg-[#e8e8e8] text-[#1a1a1a]'
                        : 'bg-[#1a1a1a] text-[#ffffff]',
                    'font-mono font-bold text-xs sm:text-sm md:text-base',
                    'rounded shadow-inner',
                    'transition-all duration-200',
                    // Apply split-flap animation class when animating
                    isAnimating && 'animate-split-flap'
                  )}
                  style={{
                    animationDelay: animationDelay,
                  }}
                >
                  {charToShow}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
