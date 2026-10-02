import type { UnitOfWork } from "#shared/application/index.js";
import type { IncomingLead } from "../../leads/index.js";
import { MetaError, type LeadPollJob } from "../domain/integration.js";
import type { PolledAd } from "../domain/snapshot.js";
import type { LeadPollJobs } from "./lead-poll-jobs.js";
import type { CredentialCipher, LeadInbox } from "./ports.js";

const FIRST_WINDOW_MS = 7 * 24 * 60 * 60_000;
const COVERAGE_OVERLAP_MS = 10 * 60_000;
const SWEEP_WINDOW_MS = 3 * 24 * 60 * 60_000;

export interface LeadReader {
  liveLeadAds(accountId: string, token: string, signal?: AbortSignal): Promise<PolledAd[]>;
  leads(accountId: string, ad: PolledAd, since: Date, token: string, signal?: AbortSignal): Promise<IncomingLead[]>;
}

export function createLeadPollWorker(d: {
  jobs: LeadPollJobs;
  cipher: CredentialCipher;
  provider: LeadReader;
  inbox: LeadInbox;
  unitOfWork: UnitOfWork;
  clock: { now(): Date };
}) {
  let polling: ReturnType<typeof setInterval> | undefined;
  let active: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let stopped = false;

  const collect = async (job: LeadPollJob, ads: readonly PolledAd[], since: Date, token: string, signal: AbortSignal, found: Map<string, IncomingLead>) => {
    for (const ad of ads) {
      for (const lead of await d.provider.leads(job.accountId, ad, since, token, signal)) {
        if (!found.has(lead.externalId)) found.set(lead.externalId, lead);
      }
    }
  };

  const poll = async (job: LeadPollJob, signal: AbortSignal) => {
    const token = d.cipher.decrypt(job.encryptedToken, job.projectId);
    const start = d.clock.now();
    const found = new Map<string, IncomingLead>();
    if (job.pollDue) {
      const since = job.leadsCoveredUntil
        ? new Date(job.leadsCoveredUntil.getTime() - COVERAGE_OVERLAP_MS)
        : new Date(start.getTime() - FIRST_WINDOW_MS);
      await collect(job, await d.provider.liveLeadAds(job.accountId, token, signal), since, token, signal, found);
    }
    if (job.sweepDue) {
      const since = new Date(start.getTime() - SWEEP_WINDOW_MS);
      await collect(job, await d.jobs.sweepAds(job, since), since, token, signal, found);
    }
    if (signal.aborted) return;
    const created = await d.unitOfWork.run(async (context) => {
      if (!await d.jobs.hold(context, job, d.clock.now())) return 0;
      const delivered = await d.inbox.deliver(context, { orgId: job.orgId, projectId: job.projectId, leads: [...found.values()] });
      await d.jobs.succeed(context, job, { polled: job.pollDue, swept: job.sweepDue, coveredUntil: job.pollDue ? start : job.leadsCoveredUntil }, d.clock.now());
      return delivered.created;
    });
    if (created > 0) d.inbox.announce({ orgId: job.orgId, projectId: job.projectId });
  };

  const run = async () => {
    const job = await d.jobs.claim(d.clock.now());
    if (!job) return false;
    controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15 * 60_000)]);
    const heartbeat = setInterval(() => {
      void d.jobs.renew(job, d.clock.now()).then((owned) => {
        if (!owned) controller?.abort();
      }).catch(() => { controller?.abort(); });
    }, 30_000);
    try {
      if (stopped) return false;
      await poll(job, signal);
    } catch (error) {
      if (error instanceof MetaError) {
        console.error("Meta lead poll failed:", error.code, error.detail);
      } else {
        console.error("Meta lead poll failed unexpectedly:", error instanceof Error ? error.message : error);
      }
      await d.jobs.fail(job, error instanceof MetaError ? error : new MetaError("PROVIDER"), d.clock.now());
    } finally {
      clearInterval(heartbeat);
      controller = undefined;
    }
    return true;
  };

  const tick = () => {
    if (stopped || active) return;
    active = (async () => {
      for (let i = 0; i < 20 && !stopped; i++) { if (!await run()) break; }
    })().catch(() => { console.error("Meta lead poll worker failed; pending work will be retried"); }).finally(() => { active = undefined; });
  };

  return {
    start() { if (polling) return; stopped = false; polling = setInterval(tick, 60_000); tick(); },
    async stop() { stopped = true; clearInterval(polling); polling = undefined; controller?.abort(); await active; },
  };
}
