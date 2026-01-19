export const VESTABOARD = {
  MAX_ROWS: 6,
  MAX_COLS: 22,
  MAX_CHARS: 132,
  SUPPORTED_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?\'"-()+=/°@#$%&*',
  FRAMED_MAX_ROWS: 5, // Max rows when frame is applied (reserves 1 row for time/weather)
  FRAMED_MAX_COLS: 21, // Max columns when frame is applied (reserves 1 col for padding)
} as const;

/**
 * Vestaboard character codes for colors and special tiles.
 *
 * IMPORTANT: Vestaboard has two physical models with different tile behaviors:
 *
 * BLACK MODEL (default):
 * - Code 0 (blank) = shows BLACK (board's natural flap color)
 * - Code 69 = WHITE color tile
 * - Use code 0 for black backgrounds
 *
 * WHITE MODEL:
 * - Code 0 (blank) = shows WHITE (board's natural flap color)
 * - Code 69 = BLACK color tile (replaces white tile on this model)
 * - Use code 69 for black backgrounds
 *
 * Set VESTABOARD_MODEL=white in .env for white Vestaboard models.
 */
export const VESTABOARD_COLORS = {
  BLANK: 0, // Shows board's natural color (black on black boards, white on white boards)
  RED: 63,
  ORANGE: 64,
  YELLOW: 65,
  GREEN: 66,
  BLUE: 67,
  VIOLET: 68,
  WHITE: 69, // White tile on black boards, BLACK tile on white boards
  BLACK: 70, // Explicit black (may not work on all firmware versions)
  FILLED: 71, // Adaptive filled tile
} as const;

/**
 * Get the correct character code for solid black based on Vestaboard model.
 *
 * @param model - 'black' (default) or 'white'
 * @returns Character code that renders as black on the specified model
 */
export function getBlackCode(model: 'black' | 'white' = 'black'): number {
  // On white Vestaboards, code 69 is the BLACK color tile
  // On black Vestaboards, code 0 (blank) shows as black
  return model === 'white' ? VESTABOARD_COLORS.WHITE : VESTABOARD_COLORS.BLANK;
}

export const UPDATE_INTERVALS = {
  MINOR_UPDATE_MS: 60 * 1000, // 1 minute
  MAJOR_UPDATE_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes minimum between major updates
} as const;

export const AI_DEFAULTS = {
  MAX_TOKENS: 500,
  TEMPERATURE: 0.7,
  TIMEOUT_MS: 30 * 1000, // 30 seconds
} as const;

export const DATABASE = {
  CONTENT_RETENTION_DAYS: 30,
  LOG_RETENTION_DAYS: 7,
  VOTE_RETENTION_DAYS: 90,
} as const;

export const WEB = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  API_TIMEOUT_MS: 10 * 1000, // 10 seconds
} as const;
