export enum RetryPolicy {
  NONE = 'NONE',
  FIXED_DELAY = 'FIXED_DELAY',
  LINEAR_BACKOFF = 'LINEAR_BACKOFF',
  EXPONENTIAL_BACKOFF = 'EXPONENTIAL_BACKOFF',
  JITTER = 'JITTER',
}

/**
 * Calculates the timestamp for the next retry attempt based on the specified retry policy.
 *
 * @param policy RetryPolicy enum value
 * @param attempt The current attempt number that just failed (1-indexed)
 * @param baseDelaySeconds Base delay in seconds (default 5s)
 * @param now Current date baseline
 */
export function calculateNextRetryAt(
  policy: RetryPolicy,
  attempt: number,
  baseDelaySeconds = 5,
  now: Date = new Date(),
): Date | null {
  if (policy === RetryPolicy.NONE) {
    return null;
  }

  const safeAttempt = Math.max(1, attempt);
  let delaySeconds = baseDelaySeconds;

  switch (policy) {
    case RetryPolicy.FIXED_DELAY:
      delaySeconds = baseDelaySeconds;
      break;

    case RetryPolicy.LINEAR_BACKOFF:
      delaySeconds = baseDelaySeconds * safeAttempt;
      break;

    case RetryPolicy.EXPONENTIAL_BACKOFF:
      delaySeconds = baseDelaySeconds * Math.pow(2, safeAttempt - 1);
      break;

    case RetryPolicy.JITTER: {
      const expDelay = baseDelaySeconds * Math.pow(2, safeAttempt - 1);
      const randomJitter = Math.random() * baseDelaySeconds;
      delaySeconds = expDelay + randomJitter;
      break;
    }

    default:
      delaySeconds = baseDelaySeconds;
  }

  return new Date(now.getTime() + Math.round(delaySeconds * 1000));
}
