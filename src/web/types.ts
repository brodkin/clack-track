// Placeholder types for web framework
// TODO: Replace with actual framework types (Express, Fastify, etc.)

import type { ContentRepository } from '../storage/repositories/content-repo.js';
import type { VoteRepository } from '../storage/repositories/vote-repo.js';
import type { LogModel } from '../storage/models/log.js';
import type { FrameDecorator } from '../content/frame/frame-decorator.js';
import type { CircuitBreakerService } from '../services/circuit-breaker-service.js';

export interface Request {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}

export interface Response {
  json(data: unknown): void;
  status(code: number): Response;
  send(data: unknown): void;
}

/**
 * Dependencies injected into WebServer from bootstrap
 *
 * All fields are optional to support graceful degradation:
 * - Server can start without database connection
 * - Routes return 503 when their required dependency is unavailable
 */
export interface WebDependencies {
  /** Repository for content CRUD operations */
  contentRepository?: ContentRepository;
  /** Repository for vote CRUD operations */
  voteRepository?: VoteRepository;
  /** Model for log operations */
  logModel?: LogModel;
  /** Frame decorator for applying time/weather frame to content */
  frameDecorator?: FrameDecorator;
  /** Service for circuit breaker state management */
  circuitBreakerService?: CircuitBreakerService;
}
