export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'rate_limit',
    'Rate limit',
    '429',
    '500',
    '502',
    '503',
    '529',
    'overloaded',
    'The operation was aborted',
  ],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: Partial<RetryOptions>,
  onRetry?: (attempt: number, error: Error, delayMs: number) => void,
): Promise<T> {
  const options = { ...DEFAULT_RETRY_OPTIONS, ...opts };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt >= options.maxRetries) break;

      // Check if error is retryable
      const errorMessage = lastError.message || '';
      const isRetryable = options.retryableErrors?.some(pattern =>
        errorMessage.includes(pattern),
      ) ?? false;

      if (!isRetryable) break;

      // Exponential backoff with jitter
      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
        options.maxDelayMs,
      );

      onRetry?.(attempt + 1, lastError, delay);

      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
