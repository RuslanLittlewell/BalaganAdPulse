import { describe, it, expect } from "vitest";
import { createGate } from "../../src/shared/infrastructure/concurrency-gate.js";
import { ServiceUnavailableError } from "../../src/shared/presentation/http-errors.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("createGate", () => {
  it("runs up to maxConcurrent tasks at once and no more", async () => {
    const gate = createGate({ maxConcurrent: 2, maxQueue: 10, maxWaitMs: 1000 });
    const blockers = [deferred(), deferred(), deferred()];
    let peak = 0;

    const runs = blockers.map((blocker) =>
      gate.run(async () => {
        peak = Math.max(peak, gate.stats().active);
        await blocker.promise;
      }),
    );

    // setImmediate, not Promise.resolve(): the gate's own `await acquire()`
    // costs a microtask per task, so a single microtask tick is not enough for
    // all three to have reached the gate.
    await new Promise((resolve) => setImmediate(resolve));
    expect(gate.stats().active).toBe(2);
    expect(gate.stats().queued).toBe(1);

    blockers.forEach((b) => b.resolve());
    await Promise.all(runs);
    expect(peak).toBe(2);
    expect(gate.stats().active).toBe(0);
  });

  it("rejects with 503 once the queue is full", async () => {
    const gate = createGate({ maxConcurrent: 1, maxQueue: 1, maxWaitMs: 1000 });
    const blocker = deferred();
    const running = gate.run(() => blocker.promise);
    const queued = gate.run(async () => {});

    await expect(gate.run(async () => {})).rejects.toBeInstanceOf(ServiceUnavailableError);

    blocker.resolve();
    await Promise.all([running, queued]);
  });

  it("rejects with 503 when the wait exceeds maxWaitMs", async () => {
    const gate = createGate({ maxConcurrent: 1, maxQueue: 5, maxWaitMs: 20 });
    const blocker = deferred();
    const running = gate.run(() => blocker.promise);

    await expect(gate.run(async () => {})).rejects.toThrow(/busy/i);

    blocker.resolve();
    await running;
  });

  it("releases its slot even when the task throws", async () => {
    const gate = createGate({ maxConcurrent: 1, maxQueue: 1, maxWaitMs: 100 });
    await expect(gate.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(gate.stats().active).toBe(0);
    await expect(gate.run(async () => "ok")).resolves.toBe("ok");
  });

  it("counts every completed run", async () => {
    const gate = createGate({ maxConcurrent: 2, maxQueue: 2, maxWaitMs: 100 });
    await gate.run(async () => {});
    await gate.run(async () => {});
    expect(gate.stats().total).toBe(2);
  });
});
