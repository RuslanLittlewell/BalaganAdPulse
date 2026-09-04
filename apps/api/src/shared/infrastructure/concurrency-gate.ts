import { ServiceUnavailableError } from "../presentation/http-errors.js";

export interface GateOptions {
  maxConcurrent: number;
  maxQueue: number;
  maxWaitMs: number;
}

export interface GateStats {
  active: number;
  queued: number;
  total: number;
}

export interface Gate {
  run<T>(fn: () => Promise<T>): Promise<T>;
  stats(): GateStats;
}

interface Waiter {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export function createGate(options: GateOptions): Gate {
  const { maxConcurrent, maxQueue, maxWaitMs } = options;
  const queue: Waiter[] = [];
  let active = 0;
  let total = 0;

  function busy(): ServiceUnavailableError {
    return new ServiceUnavailableError("Server is busy, try again shortly", 1);
  }

  function release(): void {
    active -= 1;
    const next = queue.shift();
    if (!next) return;
    clearTimeout(next.timer);
    active += 1;
    next.resolve();
  }

  async function acquire(): Promise<void> {
    if (active < maxConcurrent) {
      active += 1;
      return;
    }
    if (queue.length >= maxQueue) throw busy();

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = queue.findIndex((waiter) => waiter.timer === timer);
        if (index >= 0) queue.splice(index, 1);
        reject(busy());
      }, maxWaitMs);
      timer.unref();
      queue.push({ resolve, reject, timer });
    });
  }

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await acquire();
      total += 1;
      try {
        return await fn();
      } finally {
        release();
      }
    },
    stats: () => ({ active, queued: queue.length, total }),
  };
}
