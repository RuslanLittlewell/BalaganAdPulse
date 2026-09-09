import { createHash } from "node:crypto";
import { headObject, putObject } from "#shared/infrastructure/storage.js";
import type { CreativeFiles, StoredFile } from "../application/ports.js";
import type { CreativeKind } from "../domain/snapshot.js";

const LIMITS: Record<CreativeKind, number> = {
  IMAGE: 10 * 1024 * 1024,
  VIDEO: 25 * 1024 * 1024,
};

const FAMILY: Record<CreativeKind, string> = { IMAGE: "image/", VIDEO: "video/" };
const FALLBACK: Record<CreativeKind, string> = { IMAGE: "image/jpeg", VIDEO: "video/mp4" };

export class S3CreativeFiles implements CreativeFiles {
  private readonly seen = new Map<string, StoredFile | null>();

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  async copy(url: string, kind: CreativeKind, signal?: AbortSignal): Promise<StoredFile | null> {
    const cached = this.seen.get(url);
    if (cached !== undefined) return cached;

    const stored = await this.fetchInto(url, kind, signal);
    this.seen.set(url, stored);
    return stored;
  }

  private async fetchInto(
    url: string,
    kind: CreativeKind,
    signal?: AbortSignal,
  ): Promise<StoredFile | null> {
    let address: URL;
    try {
      address = new URL(url);
    } catch {
      return null;
    }
    if (address.protocol !== "https:" && address.protocol !== "http:") return null;

    const key = `creatives/${createHash("sha256").update(url).digest("hex")}`;
    const known = await headObject(key);
    if (known) {
      return { key, contentType: known.contentType ?? FALLBACK[kind], bytes: known.bytes };
    }

    try {
      const timeout = AbortSignal.timeout(this.timeoutMs);
      const response = await this.fetcher(address, {
        redirect: "follow",
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok) return null;

      const declared = Number(response.headers.get("content-length") ?? Number.NaN);
      if (Number.isFinite(declared) && declared > LIMITS[kind]) return null;

      const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
      if (contentType !== "" && !contentType.startsWith(FAMILY[kind])) return null;

      const body = await this.read(response, LIMITS[kind]);
      if (!body) return null;

      const type = contentType === "" ? FALLBACK[kind] : contentType;
      await putObject(key, body, type);
      return { key, contentType: type, bytes: body.length };
    } catch {
      return null;
    }
  }

  private async read(response: Response, limit: number): Promise<Buffer | null> {
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
}
