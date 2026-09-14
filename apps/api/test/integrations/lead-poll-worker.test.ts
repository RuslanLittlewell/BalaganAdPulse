import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLeadPollWorker } from "../../src/modules/integrations/application/lead-poll-worker.js";
import { MetaError, type LeadPollJob } from "../../src/modules/integrations/domain/integration.js";
import type { IncomingLead } from "../../src/modules/leads/index.js";

const now = new Date("2026-09-13T10:00:00Z");
const minutes = (count: number) => count * 60_000;
const days = (count: number) => count * 24 * 60 * 60_000;

const job = (overrides: Partial<LeadPollJob> = {}): LeadPollJob => ({
  projectId: "p", accountId: "123", encryptedToken: "encrypted", currency: "BYN", timezone: "UTC", revision: "v1",
  status: "SUCCESS", lastSuccessAt: now, lastError: null, nextDailyAt: now, queuedAt: null, retryCount: 0, leaseOwner: null, leaseUntil: null,
  leadsStatus: "WAITING", leadsCoveredUntil: null, leadsLastSuccessAt: null, leadsLastError: null, nextLeadsAt: now,
  leadsQueuedAt: null, nextSweepAt: null, leadsLeaseOwner: "owner", leadsLeaseUntil: new Date(now.getTime() + 180_000),
  orgId: "org", clientId: "client", pollDue: true, sweepDue: false,
  ...overrides,
});

const ad = (adId: string) => ({ adId, adName: `Ad ${adId}`, adSet: { externalId: "s", name: "S" }, campaign: { externalId: "c", name: "C" } });
const lead = (externalId: string) => ({ externalId, name: externalId } as IncomingLead);
const context = Object.freeze({});

function dependencies(claimed: LeadPollJob = job()) {
  return {
    jobs: {
      claim: vi.fn().mockResolvedValueOnce(claimed).mockResolvedValue(null),
      renew: vi.fn().mockResolvedValue(true),
      sweepAds: vi.fn().mockResolvedValue([]),
      hold: vi.fn().mockResolvedValue(true),
      succeed: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
    },
    cipher: { encrypt: vi.fn(), decrypt: vi.fn().mockReturnValue("synthetic-secret") },
    provider: {
      liveLeadAds: vi.fn().mockResolvedValue([ad("1")]),
      leads: vi.fn().mockResolvedValue([lead("L1")]),
    },
    inbox: { deliver: vi.fn().mockResolvedValue({ created: 1 }), announce: vi.fn(), link: vi.fn() },
    unitOfWork: { run: vi.fn(async <T>(work: (value: typeof context) => Promise<T>) => work(context)) },
    clock: { now: () => now },
  };
}

async function runOnce(d: ReturnType<typeof dependencies>) {
  const worker = createLeadPollWorker(d);
  worker.start();
  await vi.advanceTimersByTimeAsync(0);
  await worker.stop();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("lead poll worker", () => {
  it("reads the last seven days on a first poll, delivers them in one commit and announces the board", async () => {
    const d = dependencies();

    await runOnce(d);

    expect(d.provider.liveLeadAds).toHaveBeenCalledWith("123", "synthetic-secret", expect.any(AbortSignal));
    expect(d.provider.leads).toHaveBeenCalledWith("123", ad("1"), new Date(now.getTime() - days(7)), "synthetic-secret", expect.any(AbortSignal));
    expect(d.inbox.deliver).toHaveBeenCalledWith(context, { orgId: "org", clientId: "client", projectId: "p", leads: [lead("L1")] });
    expect(d.jobs.succeed).toHaveBeenCalledWith(context, expect.objectContaining({ projectId: "p" }), { polled: true, swept: false, coveredUntil: now }, now);
    expect(d.inbox.announce).toHaveBeenCalledExactlyOnceWith({ orgId: "org", clientId: "client" });
  });

  it("overlaps the covered period by ten minutes", async () => {
    const d = dependencies(job({ leadsCoveredUntil: new Date(now.getTime() - minutes(10)) }));

    await runOnce(d);

    expect(d.provider.leads).toHaveBeenCalledWith("123", ad("1"), new Date(now.getTime() - minutes(20)), "synthetic-secret", expect.any(AbortSignal));
  });

  it("catches up on every lead created during an outage", async () => {
    const d = dependencies(job({ leadsCoveredUntil: new Date(now.getTime() - minutes(6 * 60)) }));
    d.provider.liveLeadAds.mockResolvedValue([ad("1"), ad("2")]);
    d.provider.leads.mockImplementation(async (_account: string, polled: { adId: string }) => [lead(`from-${polled.adId}`)]);

    await runOnce(d);

    expect(d.provider.leads).toHaveBeenCalledTimes(2);
    expect(d.provider.leads.mock.calls.every(([, , since]) => (since as Date).getTime() === now.getTime() - minutes(6 * 60 + 10))).toBe(true);
    expect(d.inbox.deliver.mock.calls[0][1].leads.map((item: IncomingLead) => item.externalId)).toEqual(["from-1", "from-2"]);
  });

  it("advances nothing when reading fails", async () => {
    const d = dependencies(job({ leadsCoveredUntil: now }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    d.provider.leads.mockRejectedValue(new MetaError("PROVIDER", 0, "http 503"));

    await runOnce(d);

    expect(d.jobs.fail).toHaveBeenCalledWith(expect.objectContaining({ projectId: "p" }), expect.objectContaining({ code: "PROVIDER" }), now);
    expect(d.inbox.deliver).not.toHaveBeenCalled();
    expect(d.jobs.succeed).not.toHaveBeenCalled();
  });

  it("creates nothing when the connection was disconnected or its token replaced during the poll", async () => {
    const d = dependencies();
    d.jobs.hold.mockResolvedValue(false);

    await runOnce(d);

    expect(d.inbox.deliver).not.toHaveBeenCalled();
    expect(d.jobs.succeed).not.toHaveBeenCalled();
    expect(d.inbox.announce).not.toHaveBeenCalled();
    expect(d.jobs.fail).not.toHaveBeenCalled();
  });

  it("announces nothing when every lead was already imported", async () => {
    const d = dependencies();
    d.inbox.deliver.mockResolvedValue({ created: 0 });

    await runOnce(d);

    expect(d.jobs.succeed).toHaveBeenCalled();
    expect(d.inbox.announce).not.toHaveBeenCalled();
  });

  it("sweeps imported ads with recent leads over three days without moving the covered period", async () => {
    const covered = new Date(now.getTime() - minutes(5));
    const claimed = job({ pollDue: false, sweepDue: true, nextSweepAt: now, leadsCoveredUntil: covered });
    const d = dependencies(claimed);
    d.jobs.sweepAds.mockResolvedValue([ad("7")]);

    await runOnce(d);

    expect(d.provider.liveLeadAds).not.toHaveBeenCalled();
    expect(d.jobs.sweepAds).toHaveBeenCalledWith(expect.objectContaining({ projectId: "p" }), new Date(now.getTime() - days(3)));
    expect(d.provider.leads).toHaveBeenCalledExactlyOnceWith("123", ad("7"), new Date(now.getTime() - days(3)), "synthetic-secret", expect.any(AbortSignal));
    expect(d.jobs.succeed).toHaveBeenCalledWith(context, expect.anything(), { polled: false, swept: true, coveredUntil: covered }, now);
  });

  it("delivers a lead once when both the poll and the sweep return it", async () => {
    const d = dependencies(job({ sweepDue: true, nextSweepAt: now }));
    d.jobs.sweepAds.mockResolvedValue([ad("1")]);

    await runOnce(d);

    expect(d.inbox.deliver.mock.calls[0][1].leads).toEqual([lead("L1")]);
    expect(d.jobs.succeed).toHaveBeenCalledWith(context, expect.anything(), { polled: true, swept: true, coveredUntil: now }, now);
  });

  it.each(["ACCESS", "TOKEN"] as const)("records a %s refusal for the schedule to act on", async (code) => {
    const d = dependencies();
    vi.spyOn(console, "error").mockImplementation(() => {});
    d.provider.leads.mockRejectedValue(new MetaError(code));

    await runOnce(d);

    expect(d.jobs.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ code }), now);
    expect(d.inbox.deliver).not.toHaveBeenCalled();
  });

  it("stops when it loses its lease and delivers nothing from the abandoned poll", async () => {
    const d = dependencies();
    d.jobs.renew.mockResolvedValue(false);
    d.provider.leads.mockImplementation((_a: string, _b: unknown, _c: Date, _d: string, signal: AbortSignal) =>
      new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(new Error("aborted"))); }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const worker = createLeadPollWorker(d);

    worker.start();
    await vi.advanceTimersByTimeAsync(30_000);
    await worker.stop();

    expect(d.inbox.deliver).not.toHaveBeenCalled();
    expect(d.jobs.succeed).not.toHaveBeenCalled();
  });

  it("drains an in-flight poll on stop and claims no more work", async () => {
    const d = dependencies();
    let signal: AbortSignal | undefined;
    d.provider.liveLeadAds.mockImplementation((_account: string, _token: string, input: AbortSignal) => new Promise((_resolve, reject) => {
      signal = input;
      input.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const worker = createLeadPollWorker(d);

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();
    const claims = d.jobs.claim.mock.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);

    expect(signal?.aborted).toBe(true);
    expect(d.inbox.deliver).not.toHaveBeenCalled();
    expect(d.jobs.claim).toHaveBeenCalledTimes(claims);
  });
});
