import { describe, expect, it, vi } from "vitest";
import { createShutdown } from "../../src/composition/shutdown.js";

function harness(options: { closeRealtime?: () => Promise<void> } = {}) {
  const journal: string[] = [];
  const shutdown = createShutdown({
    server: {
      close: (callback) => { journal.push("server-closed"); callback(); },
    },
    closeRealtime: options.closeRealtime ?? (async () => { journal.push("realtime-closed"); }),
    disconnect: async () => { journal.push("disconnected"); },
    exit: (code) => { journal.push(`exit-${code}`); },
    log: () => undefined,
  });
  return { shutdown, journal };
}

describe("draining realtime connections on shutdown", () => {
  // Before the HTTP server closes, not after: a socket still open holds the
  // server's close callback pending, and the platform's grace period runs out
  // into a SIGKILL rather than a clean exit.
  it("closes open sockets before the server stops accepting", async () => {
    const { shutdown, journal } = harness();
    await shutdown("SIGTERM");
    expect(journal).toEqual(["realtime-closed", "server-closed", "disconnected", "exit-0"]);
  });

  // The pool still has to be released, or the process outlives the drain.
  it("still disconnects and exits when closing sockets fails", async () => {
    const { shutdown, journal } = harness({
      closeRealtime: () => Promise.reject(new Error("socket server stuck")),
    });
    await shutdown("SIGTERM");
    expect(journal).toEqual(["server-closed", "disconnected", "exit-0"]);
  });
});
