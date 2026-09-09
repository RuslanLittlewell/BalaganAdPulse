import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createImportWorker } from "../../src/modules/integrations/application/import-worker.js";
import { MetaError, type Integration } from "../../src/modules/integrations/domain/integration.js";
import type { Snapshot } from "../../src/modules/integrations/domain/snapshot.js";
const now = new Date("2026-09-08T06:00:00Z");
const job: Integration = { projectId: "p", accountId: "123", encryptedToken: "encrypted", currency: "USD", timezone: "UTC", revision: "v1", status: "RUNNING", leaseOwner: "owner", leaseUntil: new Date(now.getTime() + 180_000), queuedAt: null, nextDailyAt: now, retryCount: 0, lastSuccessAt: null, lastError: null };
const data: Snapshot = { from: "2026-08-09", to: "2026-09-07", campaigns: [], adSets: [], ads: [], campaignMetrics: [], adSetMetrics: [], adMetrics: [] };
const dependencies = () => ({
  jobs: { claim: vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null), renew: vi.fn().mockResolvedValue(true), complete: vi.fn().mockResolvedValue(true), fail: vi.fn().mockResolvedValue(undefined) },
  cipher: { encrypt: vi.fn(), decrypt: vi.fn().mockReturnValue("synthetic-secret") },
  provider: { snapshot: vi.fn().mockResolvedValue(data) }, clock: { now: () => now },
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it("processes startup work without waiting for the first minute", async () => {
  const d = dependencies();
  const worker = createImportWorker(d);
  worker.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(d.provider.snapshot).toHaveBeenCalledWith("123", "synthetic-secret", "USD", now, expect.any(AbortSignal));
  expect(d.jobs.complete).toHaveBeenCalledWith(job, data, now);
  await worker.stop();
});
it("renews long requests and drains an aborted request before stopping", async () => {
  const d = dependencies();
  let signal: AbortSignal | undefined;
  d.provider.snapshot.mockImplementation((_account, _token, _currency, _now, input: AbortSignal) => new Promise((_resolve, reject) => { signal = input; input.addEventListener("abort", () => reject(new Error("aborted"))); }));
  const worker = createImportWorker(d);
  worker.start();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(d.jobs.renew).toHaveBeenCalled();
  await worker.stop();
  expect(signal?.aborted).toBe(true);
  expect(d.jobs.complete).not.toHaveBeenCalled();
  const calls = d.jobs.claim.mock.calls.length;
  await vi.advanceTimersByTimeAsync(120_000);
  expect(d.jobs.claim).toHaveBeenCalledTimes(calls);
});
it("records safe provider errors without committing a partial snapshot", async () => {
  const d = dependencies();
  d.provider.snapshot.mockRejectedValue(new MetaError("TOKEN"));
  const worker = createImportWorker(d);
  worker.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(d.jobs.fail).toHaveBeenCalledWith(job, expect.objectContaining({ code: "TOKEN" }), now);
  expect(d.jobs.complete).not.toHaveBeenCalled();
  await worker.stop();
});
