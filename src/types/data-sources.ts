// RSS Feed Types
export interface RSSFeed {
  title: string;
  description: string;
  link: string;
  items: RSSItem[];
}

export interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: Date;
  author?: string;
}

// RapidAPI Types
export interface RapidAPIConfig {
  apiKey: string;
  host: string;
}

export interface RapidAPIResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

// Home Assistant Types
export interface HomeAssistantConfig {
  url: string;
  token: string;
  websocketUrl?: string;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

export interface HomeAssistantEvent {
  event_type: string;
  data: Record<string, unknown>;
  time_fired: Date;
  origin: string;
  context?: {
    id: string;
    parent_id?: string | null;
    user_id?: string | null;
  };
}

export interface HomeAssistantEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: Date;
  last_updated: Date;
  context?: {
    id: string;
    parent_id?: string | null;
    user_id?: string | null;
  };
}

// State changed event type
export interface StateChangedEvent extends HomeAssistantEvent {
  event_type: 'state_changed';
  data: {
    entity_id: string;
    old_state: HomeAssistantEntityState | null;
    new_state: HomeAssistantEntityState | null;
  };
}

// Unsubscribe function type
export type UnsubscribeFunc = () => void | Promise<void>;

// Service call response type
export interface ServiceCallResponse {
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

// Home Assistant Error Types
export interface HomeAssistantConnectionError extends Error {
  name: 'HomeAssistantConnectionError';
  code: 'CONNECTION_FAILED' | 'CONNECTION_LOST' | 'CONNECTION_TIMEOUT';
}

export interface HomeAssistantAuthenticationError extends Error {
  name: 'HomeAssistantAuthenticationError';
  code: 'INVALID_AUTH' | 'AUTH_REQUIRED';
}

export interface HomeAssistantTimeoutError extends Error {
  name: 'HomeAssistantTimeoutError';
  code: 'TIMEOUT';
  timeoutMs: number;
}

// Legacy alias for backward compatibility
export type HomeAssistantState = HomeAssistantEntityState;
