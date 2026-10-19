export const DUE_SOON_INTERVAL_MS = 15 * 60_000;

export function createDueSoonWorker(d: { remind: () => Promise<unknown>; intervalMs?: number }) {
  let polling: ReturnType<typeof setInterval> | undefined;
  let active: Promise<void> | undefined;
  let stopped = false;

  const tick = () => {
    if (stopped || active) return;
    active = d.remind()
      .then(() => undefined, (error: unknown) => {
        console.error("Due-soon reminders failed:", error instanceof Error ? error.message : error);
      })
      .finally(() => { active = undefined; });
  };

  return {
    start() {
      if (polling) return;
      stopped = false;
      polling = setInterval(tick, d.intervalMs ?? DUE_SOON_INTERVAL_MS);
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

export type DueSoonWorker = ReturnType<typeof createDueSoonWorker>;
