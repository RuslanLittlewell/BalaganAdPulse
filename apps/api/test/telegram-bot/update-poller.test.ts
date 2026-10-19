import { describe, expect, it, vi } from "vitest";
import {
  POLL_TIMEOUT_SECONDS,
  RETRY_INITIAL_MS,
  RETRY_MAX_MS,
  createUpdatePoller,
  type BotUpdate,
} from "../../src/modules/telegram-bot/index.js";

const update = (id: number): BotUpdate => ({ id, message: null, callback: null });

function hangingUntilAborted(signal: AbortSignal): Promise<BotUpdate[]> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
}

describe("polling Telegram for updates", () => {
  it("handles each update and asks again past the last one", async () => {
    const offsets: (number | null)[] = [];
    const getUpdates = vi.fn(async (offset: number | null, _timeout: number, signal: AbortSignal) => {
      offsets.push(offset);
      if (offsets.length === 1) return [update(10), update(11)];
      if (offsets.length === 2) return [update(12)];
      return hangingUntilAborted(signal);
    });
    const handled: number[] = [];
    const poller = createUpdatePoller({ api: { getUpdates }, handle: async (each) => { handled.push(each.id); } });

    poller.start();
    await vi.waitFor(() => expect(offsets).toHaveLength(3));
    await poller.stop();

    expect(offsets).toEqual([null, 12, 13]);
    expect(getUpdates.mock.calls[0]![1]).toBe(POLL_TIMEOUT_SECONDS);
    expect(handled).toEqual([10, 11, 12]);
  });

  it("keeps polling while an update is still being handled, and waits for it on stop", async () => {
    let finish!: () => void;
    const slow = new Promise<void>((resolve) => { finish = resolve; });
    let calls = 0;
    const getUpdates = vi.fn(async (_offset: number | null, _timeout: number, signal: AbortSignal) => {
      calls += 1;
      return calls === 1 ? [update(1)] : hangingUntilAborted(signal);
    });
    let done = false;
    const poller = createUpdatePoller({ api: { getUpdates }, handle: async () => { await slow; done = true; } });

    poller.start();
    await vi.waitFor(() => expect(calls).toBe(2));
    const stopping = poller.stop();
    expect(done).toBe(false);
    finish();
    await stopping;

    expect(done).toBe(true);
  });

  it("logs a failed update and goes on with the rest", async () => {
    let calls = 0;
    const getUpdates = vi.fn(async (_offset: number | null, _timeout: number, signal: AbortSignal) => {
      calls += 1;
      return calls === 1 ? [update(1), update(2)] : hangingUntilAborted(signal);
    });
    const handled: number[] = [];
    const log = vi.fn();
    const poller = createUpdatePoller({
      api: { getUpdates },
      handle: async (each) => {
        if (each.id === 1) throw new Error("boom");
        handled.push(each.id);
      },
      log,
    });

    poller.start();
    await vi.waitFor(() => expect(calls).toBe(2));
    await poller.stop();

    expect(handled).toEqual([2]);
    expect(log).toHaveBeenCalledWith("Telegram update 1 failed: boom");
  });

  it("backs off after failures, doubling up to a minute, and starts over after a success", async () => {
    let calls = 0;
    const getUpdates = vi.fn(async (_offset: number | null, _timeout: number, signal: AbortSignal) => {
      calls += 1;
      if (calls <= 8) throw new Error("409 Conflict");
      if (calls === 9) return [];
      if (calls === 10) throw new Error("network");
      return hangingUntilAborted(signal);
    });
    const pauses: number[] = [];
    const poller = createUpdatePoller({
      api: { getUpdates },
      handle: async () => undefined,
      pause: async (ms) => { pauses.push(ms); },
      log: () => undefined,
    });

    poller.start();
    await vi.waitFor(() => expect(calls).toBe(11));
    await poller.stop();

    expect(pauses).toEqual([
      RETRY_INITIAL_MS, 2_000, 4_000, 8_000, 16_000, 32_000, RETRY_MAX_MS, RETRY_MAX_MS, RETRY_INITIAL_MS,
    ]);
  });

  it("starts once and can be stopped before it ever started", async () => {
    const getUpdates = vi.fn((_offset: number | null, _timeout: number, signal: AbortSignal) => hangingUntilAborted(signal));
    const poller = createUpdatePoller({ api: { getUpdates }, handle: async () => undefined });

    await poller.stop();
    poller.start();
    poller.start();
    await vi.waitFor(() => expect(getUpdates).toHaveBeenCalledTimes(1));
    await poller.stop();

    expect(getUpdates).toHaveBeenCalledTimes(1);
  });
});
