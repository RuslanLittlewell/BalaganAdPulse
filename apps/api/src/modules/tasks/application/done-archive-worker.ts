export const DONE_ARCHIVE_INTERVAL_MS = 5 * 60_000;

export function createDoneArchiveWorker(d: { archive: () => Promise<unknown>; intervalMs?: number }) {
  let polling: ReturnType<typeof setInterval> | undefined;
  let active: Promise<void> | undefined;
  let stopped = false;

  const tick = () => {
    if (stopped || active) return;
    active = d.archive()
      .then(() => undefined, (error: unknown) => {
        console.error("Archiving done tasks failed:", error instanceof Error ? error.message : error);
      })
      .finally(() => { active = undefined; });
  };

  return {
    start() {
      if (polling) return;
      stopped = false;
      polling = setInterval(tick, d.intervalMs ?? DONE_ARCHIVE_INTERVAL_MS);
      tick();
    },
    async stop() {
      stopped = true;
      clearInterval(polling);
      polling = undefined;
      await active;
    },
  };
}

export type DoneArchiveWorker = ReturnType<typeof createDoneArchiveWorker>;
