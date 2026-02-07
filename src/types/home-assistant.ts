/**
 * Home Assistant WebSocket Connection Types
 *
 * These types support the HomeAssistantClient connection management.
 * They wrap the home-assistant-js-websocket library with our domain types.
 */

import type { Connection } from 'home-assistant-js-websocket';

/**
 * Home Assistant entity state structure
 */
export interface HassEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context?: {
    id: string;
    parent_id?: string;
    user_id?: string;
  };
}

/**
 * Configuration for state caching
 */
export interface StateCacheConfig {
  /**
   * Enable state caching
   * @default false
   */
  enabled: boolean;
  /**
   * Time-to-live for cached states in milliseconds
   * @default 5000
   */
  ttlMs: number;
}

/**
 * Configuration for Home Assistant WebSocket connection
 */
export interface HomeAssistantConnectionConfig {
  url: string;
  token: string;
  /**
   * Optional state caching configuration
   * If not provided, caching is disabled
   */
  stateCache?: Partial<StateCacheConfig>;
  /**
   * Optional logger for structured logging
   * If not provided, uses console logger
   */
  logger?: Logger;
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Connection state for tracking WebSocket status
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error',
}

/**
 * Internal connection wrapper with state tracking
 */
export interface ConnectionWrapper {
  connection: Connection;
  state: ConnectionState;
}

/**
 * Validation result for connection testing
 */
export interface ValidationResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

/**
 * Home Assistant event structure
 */
export interface HomeAssistantEvent {
  event_type: string;
  data: Record<string, unknown>;
  origin?: string;
  time_fired?: string;
  context?: {
    id: string;
    parent_id?: string;
    user_id?: string;
  };
}

/**
 * Event callback function type
 */
export type EventCallback = (event: HomeAssistantEvent) => void;

/**
 * Unsubscribe function type
 */
export type UnsubscribeFunction = () => void;

/**
 * Logger interface for structured logging
 */
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Base error class for Home Assistant client errors
 */
export class HomeAssistantError extends Error {
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'HomeAssistantError';
    this.originalError = originalError;
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Authentication error - thrown when authentication fails
 * Should not trigger automatic reconnection
 */
export class HAAuthenticationError extends HomeAssistantError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError);
    this.name = 'HAAuthenticationError';
  }
}

/**
 * Connection error - thrown when connection fails due to network issues
 * Can trigger automatic reconnection
 */
export class ConnectionError extends HomeAssistantError {
  public readonly url: string;

  constructor(message: string, url: string, originalError?: Error) {
    super(message, originalError);
    this.name = 'ConnectionError';
    this.url = url;
  }
}

/**
 * Subscription error - thrown when event subscription fails
 * Does not affect connection state
 */
export class SubscriptionError extends HomeAssistantError {
  public readonly eventType: string;

  constructor(message: string, eventType: string, originalError?: Error) {
    super(message, originalError);
    this.name = 'SubscriptionError';
    this.eventType = eventType;
  }
}

/**
 * State query error - thrown when state queries fail
 * Does not affect connection state
 */
export class StateQueryError extends HomeAssistantError {
  public readonly entityId?: string;

  constructor(message: string, entityId?: string, originalError?: Error) {
    super(message, originalError);
    this.name = 'StateQueryError';
    this.entityId = entityId;
  }
}

/**
 * Service call response structure
 */
export interface ServiceCallResponse {
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

/**
 * Service call error - thrown when service calls fail
 * Does not affect connection state
 */
export class ServiceCallError extends HomeAssistantError {
  public readonly domain?: string;
  public readonly service?: string;

  constructor(message: string, domain?: string, service?: string, originalError?: Error) {
    super(message, originalError);
    this.name = 'ServiceCallError';
    this.domain = domain;
    this.service = service;
  }
}
