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
}

export interface HomeAssistantEvent {
  event_type: string;
  data: Record<string, unknown>;
  time_fired: Date;
  origin: string;
}

export interface HomeAssistantState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: Date;
  last_updated: Date;
}
