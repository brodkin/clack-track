export interface VestaboardContent {
  text: string;
  layout?: VestaboardLayout;
  metadata?: {
    generatedAt: Date;
    aiProvider?: string;
    updateType: 'major' | 'minor';
  };
}

export interface VestaboardLayout {
  rows: string[];
  characterCodes?: number[][];
}

export interface ContentGenerationContext {
  type: 'major' | 'minor';
  eventData?: Record<string, unknown>;
  previousContent?: VestaboardContent;
  dataSources?: {
    rss?: unknown[];
    weather?: unknown;
    news?: unknown[];
  };
}
