import {
  isRetryableError,
  PoisonMessageError,
  NonRetryableError,
  RetryableError,
  ValidationError,
} from './index';

describe('Failure Classifier', () => {
  it('should identify PoisonMessageError as non-retryable', () => {
    const err = new PoisonMessageError('Corrupted JSON payload');
    expect(isRetryableError(err)).toBe(false);
  });

  it('should identify NonRetryableError as non-retryable', () => {
    const err = new NonRetryableError('HTTP 404 Not Found');
    expect(isRetryableError(err)).toBe(false);
  });

  it('should identify ValidationError as non-retryable', () => {
    const err = new ValidationError('Invalid field value');
    expect(isRetryableError(err)).toBe(false);
  });

  it('should identify standard Network/Timeout error as retryable', () => {
    const err = new Error('Connection timeout to SMTP server');
    expect(isRetryableError(err)).toBe(true);
  });

  it('should identify explicit RetryableError as retryable', () => {
    const err = new RetryableError('500 Internal Server Error');
    expect(isRetryableError(err)).toBe(true);
  });

  it('should classify error message containing poison indicators as non-retryable', () => {
    const err = new Error('Bad email address format');
    expect(isRetryableError(err)).toBe(false);
  });
});
