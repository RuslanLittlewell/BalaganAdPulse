import { Bitrix24Error, type Bitrix24ErrorKind } from "../domain/bitrix24-error.js";
import type { Bitrix24Api } from "../application/ports.js";

type Raw = Record<string, unknown>;

const AUTH_CODES = new Set([
  "EXPIRED_TOKEN", "INVALID_TOKEN", "INVALID_CREDENTIALS", "NO_AUTH_FOUND", "WRONG_AUTH_TYPE", "INSUFFICIENT_SCOPE", "AUTHORIZATION_ERROR",
]);

export function classifyBitrix24Error(code: string, description: string, status: number): Bitrix24Error {
  const upper = code.toUpperCase();
  const message = [code, description].filter(Boolean).join(": ") || `HTTP ${status}`;
  let kind: Bitrix24ErrorKind = "REFUSED";
  if (upper === "QUERY_LIMIT_EXCEEDED" || status === 429) kind = "RATE";
  else if (AUTH_CODES.has(upper) || status === 401) kind = "AUTH";
  else if (upper === "NOT_FOUND" || status === 404 || /not found/i.test(description)) kind = "NOT_FOUND";
  else if (status >= 500 || upper === "INTERNAL_SERVER_ERROR") kind = "TRANSIENT";
  return new Bitrix24Error(kind, message);
}

export interface RestClientOptions {
  minIntervalMs?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
  isPublicHost?: (host: string) => Promise<boolean>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Bitrix24RestClient implements Bitrix24Api {
  private last = 0;

  constructor(private readonly base: string, private readonly options: RestClientOptions = {}) {}

  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    return (await this.request(method, params)).result as T;
  }

  async list<T = unknown>(method: string, params?: Record<string, unknown>): Promise<{ items: T[]; next: number | null }> {
    const body = await this.request(method, params);
    return {
      items: Array.isArray(body.result) ? body.result as T[] : [],
      next: typeof body.next === "number" ? body.next : null,
    };
  }

  private async pace(): Promise<void> {
    const wait = this.last + (this.options.minIntervalMs ?? 500) - Date.now();
    if (wait > 0) await sleep(wait);
    this.last = Date.now();
  }

  private async request(method: string, params?: Record<string, unknown>): Promise<Raw> {
    await this.pace();
    const url = new URL(`${this.base}${method}.json`);
    if (this.options.isPublicHost && !(await this.options.isPublicHost(url.hostname))) {
      throw new Bitrix24Error("REFUSED", "The portal address is not public");
    }
    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(params ?? {}),
        redirect: "error",
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 20_000),
      });
    } catch {
      throw new Bitrix24Error("TRANSIENT", "The portal did not answer");
    }
    let body: Raw | null = null;
    try {
      const parsed: unknown = await response.json();
      body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Raw : null;
    } catch {
      body = null;
    }
    if (body && body.error !== undefined && body.error !== null) {
      throw classifyBitrix24Error(String(body.error), String(body.error_description ?? ""), response.status);
    }
    if (!response.ok) throw classifyBitrix24Error("", "", response.status);
    if (!body) throw new Bitrix24Error("TRANSIENT", "The portal answered without JSON");
    return body;
  }
}
