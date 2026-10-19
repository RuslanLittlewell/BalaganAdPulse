import type { BotApi, BotUpdate } from "#modules/telegram-bot/application/bot-api.js";

export const POLL_TIMEOUT_SECONDS = 25;
export const RETRY_INITIAL_MS = 1_000;
export const RETRY_MAX_MS = 60_000;

export interface UpdatePollerDependencies {
  readonly api: Pick<BotApi, "getUpdates">;
  readonly handle: (update: BotUpdate) => Promise<void>;
  readonly pause?: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly log?: (message: string) => void;
}

function pauseFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

const reason = (error: unknown) => error instanceof Error ? error.message : String(error);

export function createUpdatePoller(d: UpdatePollerDependencies) {
  const pause = d.pause ?? pauseFor;
  const log = d.log ?? ((message: string) => console.error(message));
  const inFlight = new Set<Promise<void>>();
  let controller: AbortController | null = null;
  let loop: Promise<void> | null = null;

  const dispatch = (update: BotUpdate) => {
    const work = d.handle(update)
      .catch((error: unknown) => log(`Telegram update ${update.id} failed: ${reason(error)}`))
      .finally(() => { inFlight.delete(work); });
    inFlight.add(work);
  };

  const run = async (signal: AbortSignal) => {
    let offset: number | null = null;
    let retry = RETRY_INITIAL_MS;
    while (!signal.aborted) {
      try {
        const updates = await d.api.getUpdates(offset, POLL_TIMEOUT_SECONDS, signal);
        retry = RETRY_INITIAL_MS;
        for (const update of updates) {
          offset = Math.max(offset ?? 0, update.id + 1);
          dispatch(update);
        }
      } catch (error) {
        if (signal.aborted) break;
        log(`Telegram polling failed: ${reason(error)}`);
        await pause(retry, signal);
        retry = Math.min(retry * 2, RETRY_MAX_MS);
      }
    }
  };

  return {
    start() {
      if (loop) return;
      controller = new AbortController();
      loop = run(controller.signal);
    },
    async stop() {
      controller?.abort();
      await loop;
      await Promise.all([...inFlight]);
      loop = null;
      controller = null;
    },
  };
}

export type UpdatePoller = ReturnType<typeof createUpdatePoller>;
