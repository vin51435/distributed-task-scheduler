import { AppError } from './app-error';
import { ValidationError } from './validation.error';

export class PoisonMessageError extends AppError {
  public readonly statusCode = 400;
  public readonly errorCode = 'POISON_MESSAGE';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class NonRetryableError extends AppError {
  public readonly statusCode = 400;
  public readonly errorCode = 'NON_RETRYABLE_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class RetryableError extends AppError {
  public readonly statusCode = 500;
  public readonly errorCode = 'RETRYABLE_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

/**
 * Classifies an error to determine whether the job execution should be retried.
 */
export function isRetryableError(err: any): boolean {
  if (!err) return false;

  if (
    err instanceof PoisonMessageError ||
    err instanceof NonRetryableError ||
    err instanceof ValidationError
  ) {
    return false;
  }

  if (typeof err.isRetryable === 'boolean') {
    return err.isRetryable;
  }

  const message = (err.message || String(err)).toLowerCase();

  // Non-retryable indicators: Bad email, 404 Not Found, Invalid Payload, SyntaxError
  if (
    message.includes('poison message') ||
    message.includes('invalid payload') ||
    message.includes('bad email') ||
    message.includes('404 not found') ||
    message.includes('syntaxerror')
  ) {
    return false;
  }

  return true;
}
