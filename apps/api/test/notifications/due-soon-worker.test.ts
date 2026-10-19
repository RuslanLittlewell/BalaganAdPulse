import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDueSoonWorker } from "../../src/modules/notifications/index.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("looks for deadlines at once and then every interval, until stopped", async () => {
  const remind = vi.fn().mockResolvedValue(0);
  const worker = createDueSoonWorker({ remind, intervalMs: 1_000 });

  worker.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(remind).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2_000);
  expect(remind).toHaveBeenCalledTimes(3);

  await worker.stop();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(remind).toHaveBeenCalledTimes(3);
});

it("reports a failed round and keeps going", async () => {
  const reported = vi.spyOn(console, "error").mockImplementation(() => {});
  const remind = vi.fn().mockRejectedValueOnce(new Error("database away")).mockResolvedValue(0);
  const worker = createDueSoonWorker({ remind, intervalMs: 1_000 });

  worker.start();
  await vi.advanceTimersByTimeAsync(1_000);

  expect(reported).toHaveBeenCalledWith("Due-soon reminders failed:", "database away");
  expect(remind).toHaveBeenCalledTimes(2);
  await worker.stop();
  reported.mockRestore();
});

it("waits for a round in progress when stopped", async () => {
  let finish: () => void = () => {};
  const remind = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const worker = createDueSoonWorker({ remind, intervalMs: 1_000 });
  worker.start();

  let stopped = false;
  const stopping = worker.stop().then(() => { stopped = true; });
  await vi.advanceTimersByTimeAsync(0);
  expect(stopped).toBe(false);

  finish();
  await stopping;
  expect(stopped).toBe(true);
});
