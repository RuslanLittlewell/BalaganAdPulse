import type { ImportJobs } from "./import-jobs.js";
import type { CredentialCipher, LeadInbox } from "./ports.js";
import { ProviderError, type Integration } from "../domain/integration.js";
import type { Snapshot } from "../domain/snapshot.js";

export interface SnapshotSource {
  snapshot(
    account: Pick<Integration, "accountId" | "currency" | "loginCustomerId">,
    token: string,
    now: Date,
    signal?: AbortSignal,
  ): Promise<Snapshot>;
}

export function createImportWorker(d: {
  jobs: ImportJobs;
  cipher: CredentialCipher;
  providers: Record<string, SnapshotSource>;
  clock: { now(): Date };
  leads: Pick<LeadInbox, "link">;
  imports: { finished(projectId: string): void };
}) {
  let polling: ReturnType<typeof setInterval> | undefined;
  let active: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let stopped = false;
  const run = async () => {
    const job = await d.jobs.claim(d.clock.now());
    if (!job) return false;
    controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(15 * 60_000),
    ]);
    const heartbeat = setInterval(() => {
      void d.jobs
        .renew(job, d.clock.now())
        .then((owned) => {
          if (!owned) controller?.abort();
        })
        .catch(() => {
          controller?.abort();
        });
    }, 30_000);
    try {
      if (stopped) return false;
      const token = d.cipher.decrypt(job.encryptedToken, job.projectId);
      const source = d.providers[job.provider];
      if (!source) throw new ProviderError("CONFIGURATION");
      const snapshot = await source.snapshot(job, token, d.clock.now(), signal);
      if (
        signal.aborted ||
        !(await d.jobs.complete(job, snapshot, d.clock.now()))
      )
        return true;
      d.imports.finished(job.projectId);
      await d.leads.link(job.projectId).catch((error: unknown) => {
        console.error(
          "Linking imported leads failed:",
          error instanceof Error ? error.message : error,
        );
      });
    } catch (error) {
      if (error instanceof ProviderError) {
        console.error(`${job.provider} import failed:`, error.code, error.detail);
      } else {
        console.error(
          `${job.provider} import failed unexpectedly:`,
          error instanceof Error ? error.message : error,
        );
      }
      await d.jobs.fail(
        job,
        error instanceof ProviderError ? error : new ProviderError("PROVIDER"),
        d.clock.now(),
      );
    } finally {
      clearInterval(heartbeat);
      controller = undefined;
    }
    return true;
  };
  const tick = () => {
    if (stopped || active) return;
    active = (async () => {
      for (let i = 0; i < 20 && !stopped; i++) {
        if (!(await run())) break;
      }
    })()
      .catch(() => {
        console.error(
          "Import worker failed; pending work will be retried",
        );
      })
      .finally(() => {
        active = undefined;
      });
  };
  return {
    start() {
      if (polling) return;
      stopped = false;
      polling = setInterval(tick, 60_000);
      tick();
    },
    async stop() {
      stopped = true;
      clearInterval(polling);
      polling = undefined;
      controller?.abort();
      await active;
    },
  };
}
