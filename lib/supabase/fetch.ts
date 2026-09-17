/**
 * `fetch` for every Supabase client, with one retry on a dropped connection.
 *
 * The first request after a serverless function starts cold sometimes fails
 * before a byte is sent ("TypeError: fetch failed": DNS, TLS or a reset
 * socket). Without this the doctor sees an error screen on the first page
 * after signing in. Only requests that are safe to repeat are retried
 * (GET/HEAD, and the auth token refresh); a failed insert is never sent
 * twice. Kept dependency-free and module-scope-free so it can be imported
 * from middleware as well as server code.
 */

const RETRY_DELAY_MS = 350;

function isRetryable(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method === "GET" || method === "HEAD") return true;
  // Token refreshes are idempotent from our side and happen on the first request.
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return method === "POST" && /\/auth\/v1\/token\b/.test(url);
}

function isConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return false;
  const cause = (error as { cause?: { code?: string; message?: string } }).cause;
  return (
    /fetch failed|network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up/i.test(
      `${error.message} ${cause?.code ?? ""} ${cause?.message ?? ""}`,
    )
  );
}

export const retryingFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (!isRetryable(input, init) || !isConnectionFailure(error)) throw error;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return fetch(input, init);
  }
};
