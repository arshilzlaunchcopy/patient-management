import "server-only";

/**
 * Serverless functions start cold and Supabase occasionally drops the first
 * connection of a burst ("fetch failed", a reset socket, a gateway 5xx).
 * One retry after a short pause turns that into a slightly slower page
 * instead of an error screen. Anything else is thrown straight through.
 */
const TRANSIENT_RE =
  /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|network|timed? ?out|50[234]|upstream|too many connections|canceling statement/i;

export function isTransientError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${(error as { cause?: { message?: string } }).cause?.message ?? ""}`
      : String(error ?? "");
  return TRANSIENT_RE.test(message);
}

export async function withRetry<T>(fn: () => Promise<T>, delayMs = 400): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isTransientError(e)) throw e;
    await new Promise((r) => setTimeout(r, delayMs));
    return fn();
  }
}
