import type { SeoSite } from "../domain/seo-site.js";

export interface LeasedJobs {
  claim(now: Date): Promise<SeoSite | null>;
  renew(job: SeoSite, now: Date): Promise<boolean>;
}

export interface JobLoop {
  readonly jobs: LeasedJobs;
  readonly run: (job: SeoSite, signal: AbortSignal) => Promise<void>;
  readonly concurrency: number;
  readonly timeoutMs: number;
}

const POLL_MS = 60_000;
const HEARTBEAT_MS = 30_000;

export function createSeoWorker(d: { loops: readonly JobLoop[]; clock: { now(): Date } }) {
  let polling: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  const controllers = new Set<AbortController>();
  const active = new Map<JobLoop, Promise<void>>();

  const runOne = async (loop: JobLoop): Promise<boolean> => {
    if (stopped) return false;
    const job = await loop.jobs.claim(d.clock.now());
    if (!job) return false;
    const controller = new AbortController();
    controllers.add(controller);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(loop.timeoutMs)]);
    const heartbeat = setInterval(() => {
      void loop.jobs.renew(job, d.clock.now())
        .then((owned) => { if (!owned) controller.abort(); })
        .catch(() => controller.abort());
    }, HEARTBEAT_MS);
    try {
      await loop.run(job, signal);
    } finally {
      clearInterval(heartbeat);
      controllers.delete(controller);
    }
    return true;
  };

  const drain = async (loop: JobLoop) => {
    for (let i = 0; i < 20 && !stopped; i++) {
      if (!(await runOne(loop))) break;
    }
  };

  const tick = () => {
    for (const loop of d.loops) {
      if (stopped || active.has(loop)) continue;
      const lanes = Array.from({ length: loop.concurrency }, () => drain(loop));
      const work = Promise.all(lanes)
        .then(() => undefined)
        .catch((error: unknown) => {
          console.error("SEO worker failed; pending work will be retried", error instanceof Error ? error.message : error);
        })
        .finally(() => active.delete(loop));
      active.set(loop, work);
    }
  };

  return {
    start() {
      if (polling) return;
      stopped = false;
      polling = setInterval(tick, POLL_MS);
      tick();
    },
    async stop() {
      stopped = true;
      clearInterval(polling);
      polling = undefined;
      for (const controller of controllers) controller.abort();
      await Promise.all(active.values());
    },
    tick,
  };
}
