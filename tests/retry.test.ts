import { withRetry } from '../src/retry';

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return 'success';
    }, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 });

    expect(result).toBe('success');
    expect(calls).toBe(1);
  });

  it('retries on retryable error and succeeds', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('rate_limit exceeded');
      return 'success after retry';
    }, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 });

    expect(result).toBe('success after retry');
    expect(calls).toBe(3);
  });

  it('throws after max retries exhausted', async () => {
    let calls = 0;
    await expect(withRetry(async () => {
      calls++;
      throw new Error('503 Service Unavailable');
    }, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 })).rejects.toThrow('503');

    expect(calls).toBe(3); // initial + 2 retries
  });

  it('does not retry non-retryable errors', async () => {
    let calls = 0;
    await expect(withRetry(async () => {
      calls++;
      throw new Error('Invalid API key');
    }, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 })).rejects.toThrow('Invalid API key');

    expect(calls).toBe(1); // no retry
  });

  it('calls onRetry callback on each retry', async () => {
    const retries: number[] = [];
    let calls = 0;

    await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error('ECONNRESET');
        return 'ok';
      },
      { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 },
      (attempt) => retries.push(attempt),
    );

    expect(retries).toEqual([1, 2]);
  });

  it('respects custom retryable errors list', async () => {
    let calls = 0;
    await expect(withRetry(async () => {
      calls++;
      throw new Error('custom-error-code');
    }, {
      maxRetries: 2,
      baseDelayMs: 10,
      maxDelayMs: 100,
      retryableErrors: ['custom-error-code'],
    })).rejects.toThrow('custom-error-code');

    expect(calls).toBe(3); // retried because it's in the custom list
  });
});
