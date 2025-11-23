import { ContentRecord, LogRecord } from '../storage/models/index.js';

// API Response Types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface ContentResponse {
  content: ContentRecord;
  votes?: {
    good: number;
    bad: number;
  };
}

export interface ContentHistoryResponse {
  items: ContentRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface VoteSubmission {
  contentId: string;
  vote: 'good' | 'bad';
}

export interface LogsResponse {
  logs: LogRecord[];
  total: number;
  filters: {
    level?: string;
    limit: number;
  };
}
