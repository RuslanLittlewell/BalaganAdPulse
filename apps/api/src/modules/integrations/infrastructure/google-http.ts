import { ProviderError } from "../domain/integration.js";

const MAX_BODY_BYTES = 20_000_000;

export interface GoogleResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly body: unknown;
  readonly retryAfterMs: number;
}

export function retryDelay(header: string | null): number {
  if (!header) return 0;
  const delay = /^\d+$/.test(header) ? Number(header) * 1000 : Math.max(0, Date.parse(header) - Date.now());
  return Number.isFinite(delay) ? delay : 0;
}

export async function exchange(
  fetcher: typeof fetch,
  url: URL | string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<GoogleResponse> {
  try {
    const timeout = AbortSignal.timeout(timeoutMs);
    const response = await fetcher(url, { ...init, redirect: "error", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError("INVALID_DATA", 0, "", "Google");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ProviderError("INVALID_DATA", 0, "response too large", "Google");
      }
      chunks.push(value);
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      body = null;
    }
    return { status: response.status, ok: response.ok, body, retryAfterMs: retryDelay(response.headers.get("retry-after")) };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("PROVIDER", 0, error instanceof Error ? error.message : "unknown", "Google");
  }
}
