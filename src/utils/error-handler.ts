import { error as logError } from './logger.js';

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, metadata);
    this.name = 'ValidationError';
  }
}

export class APIError extends AppError {
  constructor(message: string, provider: string, metadata?: Record<string, unknown>) {
    super(message, 'API_ERROR', 502, { ...metadata, provider });
    this.name = 'APIError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export function handleError(err: unknown): void {
  if (err instanceof AppError) {
    logError(`[${err.code}] ${err.message}`, err.metadata);
  } else if (err instanceof Error) {
    logError(`Unexpected error: ${err.message}`, { stack: err.stack });
  } else {
    logError('Unknown error occurred', err);
  }
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof APIError) {
    return true; // Retry API errors
  }
  return false;
}
