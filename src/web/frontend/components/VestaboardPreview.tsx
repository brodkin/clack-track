/**
 * VestaboardPreview Component
 *
 * Displays Vestaboard content in a 6x22 character grid with split-flap aesthetic
 */

import { cn } from '../lib/utils';

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
  63: '#ff0000', // red
  64: '#ff8800', // orange
  65: '#ffee00', // yellow
  66: '#00ff00', // green
  67: '#0044ff', // blue
  68: '#9900ff', // violet
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
 * VestaboardPreview displays a 6x22 grid of characters with split-flap styling
 */
export function VestaboardPreview({ content, className, model = 'black' }: VestaboardPreviewProps) {
  // Ensure we always have 6 rows
  const rows = Array.from({ length: 6 }, (_, rowIndex) => {
    const row = content[rowIndex] || [];
    // Ensure each row has 22 cells
    return Array.from({ length: 22 }, (_, colIndex) => row[colIndex] ?? 0);
  });

  // Color schemes based on Vestaboard hardware model
  // Black model: off-black board (#0a0a0a), near-black flaps (#1a1a1a), white text (#ffffff)
  // White model: off-white board (#f5f5f5), near-white flaps (#e8e8e8), dark text (#1a1a1a)
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
                    'transition-all duration-200'
                  )}
                >
                  {/* Color tiles display no text, regular cells show character */}
                  {colorTileBg ? '' : CHAR_MAP[charCode] || ' '}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
