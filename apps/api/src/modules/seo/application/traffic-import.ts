import { SeoProviderError, type SeoSite } from "../domain/seo-site.js";
import { cappedPerDay, trafficWindow } from "../domain/traffic.js";
import type { Analytics, Cipher, TrafficJobs } from "./ports.js";

export function createTrafficImport(d: {
  jobs: TrafficJobs;
  cipher: Cipher;
  analytics: Analytics | null;
  clock: { now(): Date };
}) {
  return async (job: SeoSite, signal: AbortSignal): Promise<void> => {
    try {
      if (!job.analyticsPropertyId) {
        await d.jobs.release(job, d.clock.now());
        return;
      }
      if (!d.analytics) throw new SeoProviderError("CONFIGURATION");
      const refreshToken = d.cipher.decrypt(job.encryptedToken, job.projectId);
      const access = await d.analytics.accessToken(refreshToken, signal);
      const window = trafficWindow(d.clock.now().toISOString().slice(0, 10), job.trafficSuccessAt === null);
      const rows = await d.analytics.sessions(access, job.analyticsPropertyId, window.from, window.to, signal);
      if (signal.aborted) return;
      await d.jobs.complete(job, { ...window, rows: cappedPerDay(rows) }, d.clock.now());
    } catch (error) {
      const failure = error instanceof SeoProviderError ? error : new SeoProviderError("PROVIDER", 0, error instanceof Error ? error.message : "unknown");
      console.error("Analytics import failed:", failure.code, failure.detail);
      await d.jobs.fail(job, failure.code, failure.retryAfterMs, d.clock.now());
    }
  };
}
