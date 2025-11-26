export class VestaboardError extends Error {
  public readonly isRetryable: boolean;

  constructor(message: string, isRetryable = false) {
    super(message);
    this.name = 'VestaboardError';
    this.isRetryable = isRetryable;
    Object.setPrototypeOf(this, VestaboardError.prototype);
  }
}

export class VestaboardAuthenticationError extends VestaboardError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message, false);
    this.name = 'VestaboardAuthenticationError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, VestaboardAuthenticationError.prototype);
  }
}

export class VestaboardConnectionError extends VestaboardError {
  constructor(message: string) {
    super(message, true);
    this.name = 'VestaboardConnectionError';
    Object.setPrototypeOf(this, VestaboardConnectionError.prototype);
  }
}

export class VestaboardValidationError extends VestaboardError {
  constructor(message: string) {
    super(message, false);
    this.name = 'VestaboardValidationError';
    Object.setPrototypeOf(this, VestaboardValidationError.prototype);
  }
}

export class VestaboardTimeoutError extends VestaboardError {
  constructor(message: string) {
    super(message, true);
    this.name = 'VestaboardTimeoutError';
    Object.setPrototypeOf(this, VestaboardTimeoutError.prototype);
  }
}

export class VestaboardRateLimitError extends VestaboardError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message, true);
    this.name = 'VestaboardRateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, VestaboardRateLimitError.prototype);
  }
}

export class VestaboardServerError extends VestaboardError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message, true);
    this.name = 'VestaboardServerError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, VestaboardServerError.prototype);
  }
}
