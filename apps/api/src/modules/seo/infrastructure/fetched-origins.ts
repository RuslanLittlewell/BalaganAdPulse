import type { OriginFinder } from "../application/search-import.js";
import { isOnSite } from "../domain/seo-site.js";
import type { PageFetcher } from "../application/ports.js";

const PROBE_BYTES = 65_536;

export class FetchedOrigins implements OriginFinder {
  constructor(private readonly fetcher: PageFetcher) {}

  async settle(address: string, siteUrl: string): Promise<string | null> {
    const outcome = await this.fetcher.fetch(address, (next) => isOnSite(siteUrl, next), { maxBytes: PROBE_BYTES });
    return outcome.kind === "response" && outcome.status < 400 ? new URL(outcome.finalUrl).origin : null;
  }
}
