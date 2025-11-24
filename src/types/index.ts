// Legacy types (kept for backwards compatibility)
export interface VestaboardConfig {
  apiKey: string;
  apiUrl: string;
}

export interface VestaboardMessage {
  text: string;
  layout?: string;
}

export enum ContentType {
  MOTIVATIONAL = 'motivational',
  INFORMATIONAL = 'informational',
  REMINDER = 'reminder',
  CUSTOM = 'custom',
}

// Export all new types
export * from './ai.js';
export * from './content.js';
export * from './data-sources.js';
export * from './errors.js';
export * from './home-assistant.js';
export * from './web.js';
