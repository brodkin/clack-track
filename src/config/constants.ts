export const VESTABOARD = {
  MAX_ROWS: 6,
  MAX_COLS: 22,
  MAX_CHARS: 132,
  SUPPORTED_CHARS: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?'-()/@#$%&*",
} as const;

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
