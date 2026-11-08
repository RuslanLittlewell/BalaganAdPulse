import { describe, expect, it, vi } from "vitest";
import { createTrafficImport } from "../../src/modules/seo/application/traffic-import.js";
import { SeoProviderError, type SeoSite } from "../../src/modules/seo/domain/seo-site.js";
import { cappedPerDay, trafficWindow } from "../../src/modules/seo/domain/traffic.js";

const NOW = new Date("2026-11-07T06:00:00Z");
const site = (over: Partial<SeoSite> = {}): SeoSite => ({
  id: "s1", projectId: "p1", siteUrl: "https://shop.ru/", origin: null, encryptedToken: "enc(refresh)", revision: "v1",
  status: "SUCCESS", lastSuccessAt: NOW, lastError: null, nextDailyAt: NOW, queuedAt: null, retryCount: 0,
  leaseOwner: null, leaseUntil: null, vitalsReadAt: null, checkStatus: "SUCCESS", lastCheckAt: null, checkError: null,
  nextCheckAt: NOW, checkQueuedAt: null, checkLeaseOwner: null, checkLeaseUntil: null,
  analyticsPropertyId: "111", analyticsName: "site.ru", trafficStatus: "RUNNING", trafficSuccessAt: null, trafficError: null,
  nextTrafficAt: NOW, trafficQueuedAt: null, trafficRetryCount: 0, trafficLeaseOwner: "me", trafficLeaseUntil: NOW,
  createdAt: NOW,
  ...over,
});

function fixture(sessions = vi.fn(async () => [{ date: "2026-11-05", channel: "Direct", source: "(direct)", medium: "(none)", sessions: 5 }])) {
  const jobs = {
    claim: vi.fn(), renew: vi.fn(),
    complete: vi.fn(async () => true), release: vi.fn(async () => {}), fail: vi.fn(async () => {}),
  };
  const analytics = {
    consentUrl: vi.fn(), accessToken: vi.fn(async (refresh: string) => `access(${refresh})`), properties: vi.fn(), sessions,
  };
  const cipher = { encrypt: (token: string) => token, decrypt: (value: string) => value.replace(/^enc\((.*)\)$/, "$1") };
  const run = createTrafficImport({ jobs, cipher, analytics, clock: { now: () => NOW } });
  return { jobs, analytics, run: (job: SeoSite) => run(job, new AbortController().signal) };
}

describe("the traffic window", () => {
  it("loads 90 days the first time and re-reads 3 days afterwards, ending yesterday", () => {
    expect(trafficWindow("2026-11-07", true)).toEqual({ from: "2026-08-09", to: "2026-11-06" });
    expect(trafficWindow("2026-11-07", false)).toEqual({ from: "2026-11-04", to: "2026-11-06" });
  });

  it("keeps the 200 biggest pairs of each day", () => {
    const rows = Array.from({ length: 250 }, (_, n) => ({ date: "2026-11-05", channel: "Referral", source: `s${n}`, medium: "referral", sessions: n }));
    const kept = cappedPerDay([...rows, { date: "2026-11-06", channel: "Direct", source: "(direct)", medium: "(none)", sessions: 1 }]);
    expect(kept).toHaveLength(201);
    expect(kept.filter((row) => row.date === "2026-11-05").map((row) => row.sessions)).not.toContain(0);
  });
});

describe("the traffic import", () => {
  it("loads 90 days on the first import and publishes them", async () => {
    const d = fixture();
    await d.run(site());
    expect(d.analytics.sessions).toHaveBeenCalledWith("access(refresh)", "111", "2026-08-09", "2026-11-06", expect.anything());
    expect(d.jobs.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ from: "2026-08-09", to: "2026-11-06", rows: [expect.objectContaining({ sessions: 5 })] }), NOW);
  });

  it("re-reads 3 days once a first import succeeded", async () => {
    const d = fixture();
    await d.run(site({ trafficSuccessAt: NOW }));
    expect(d.analytics.sessions).toHaveBeenCalledWith("access(refresh)", "111", "2026-11-04", "2026-11-06", expect.anything());
  });

  it("publishes nothing when Google fails", async () => {
    const d = fixture(vi.fn(async () => { throw new SeoProviderError("PROVIDER", 5000); }));
    await d.run(site());
    expect(d.jobs.complete).not.toHaveBeenCalled();
    expect(d.jobs.fail).toHaveBeenCalledWith(expect.anything(), "PROVIDER", 5000, NOW);
  });

  it("asks to sign in again when the credential is rejected", async () => {
    const d = fixture(vi.fn(async () => { throw new SeoProviderError("TOKEN"); }));
    await d.run(site());
    expect(d.jobs.fail).toHaveBeenCalledWith(expect.anything(), "TOKEN", 0, NOW);
  });

  it("lets go of a site whose property was unlinked", async () => {
    const d = fixture();
    await d.run(site({ analyticsPropertyId: null }));
    expect(d.jobs.release).toHaveBeenCalled();
    expect(d.analytics.sessions).not.toHaveBeenCalled();
  });
});
