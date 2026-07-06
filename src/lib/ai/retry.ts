/** Retries transient failures (5xx, network, overload) with short exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      const transient = /5\d\d|timeout|ECONNRESET|fetch failed|overloaded/i.test(message);
      if (!transient || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw lastErr;
}
