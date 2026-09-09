import type { ImportJobs } from "./import-jobs.js";
import type { CredentialCipher } from "./ports.js";
import { MetaError } from "../domain/integration.js";
import type { Snapshot } from "../domain/snapshot.js";

export function createImportWorker(d: {
  jobs: ImportJobs;
  cipher: CredentialCipher;
  provider: { snapshot(accountId: string, token: string, currency: string, now: Date, signal?: AbortSignal): Promise<Snapshot> };
  clock: { now(): Date };
}) {
  let polling: ReturnType<typeof setInterval> | undefined;
  let active: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let stopped = false;
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
      const token = d.cipher.decrypt(job.encryptedToken, job.projectId);
      const snapshot = await d.provider.snapshot(job.accountId, token, job.currency, d.clock.now(), signal);
      if (!signal.aborted) await d.jobs.complete(job, snapshot, d.clock.now());
    } catch (error) {
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
    })().catch(() => { console.error("Meta import worker failed; pending work will be retried"); }).finally(() => { active = undefined; });
  };
  return {
    start() { if (polling) return; stopped = false; polling = setInterval(tick, 60_000); tick(); },
    async stop() { stopped = true; clearInterval(polling); polling = undefined; controller?.abort(); await active; },
  };
}
