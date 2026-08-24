import { describe, it, expect, vi } from "vitest";
import { createShutdown } from "../src/shutdown.js";

function deps(closeError?: Error) {
  return {
    server: { close: vi.fn((cb: (err?: Error) => void) => cb(closeError)) },
    disconnect: vi.fn(async () => {}),
    exit: vi.fn(),
    log: vi.fn(),
  };
}

describe("createShutdown", () => {
  it("drains the server, then disconnects, then exits 0", async () => {
    const d = deps();
    await createShutdown(d)("SIGTERM");
    expect(d.server.close).toHaveBeenCalled();
    expect(d.disconnect).toHaveBeenCalled();
    expect(d.exit).toHaveBeenCalledWith(0);
  });

  it("disconnects even when the server reports a close error", async () => {
    const d = deps(new Error("already closed"));
    await createShutdown(d)("SIGTERM");
    expect(d.disconnect).toHaveBeenCalled();
    expect(d.exit).toHaveBeenCalledWith(1);
  });

  it("does not begin disconnecting until the server has finished draining", async () => {
    const disconnect = vi.fn(async () => {});
    let disconnectStartedDuringDrain: boolean | undefined;
    const server = {
      close: vi.fn((cb: (error?: Error) => void) => {
        setTimeout(() => {
          disconnectStartedDuringDrain = disconnect.mock.calls.length > 0;
          cb(undefined);
        }, 10);
      }),
    };
    await createShutdown({ server, disconnect, exit: vi.fn(), log: vi.fn() })("SIGTERM");
    expect(disconnectStartedDuringDrain).toBe(false);
  });

  it("does not begin disconnecting until draining finishes, even on a close error", async () => {
    const disconnect = vi.fn(async () => {});
    let disconnectStartedDuringDrain: boolean | undefined;
    const server = {
      close: vi.fn((cb: (error?: Error) => void) => {
        setTimeout(() => {
          disconnectStartedDuringDrain = disconnect.mock.calls.length > 0;
          cb(new Error("already closed"));
        }, 10);
      }),
    };
    const exit = vi.fn();
    await createShutdown({ server, disconnect, exit, log: vi.fn() })("SIGTERM");
    expect(disconnectStartedDuringDrain).toBe(false);
    expect(disconnect).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("ignores a second signal instead of exiting twice", async () => {
    const d = deps();
    const shutdown = createShutdown(d);
    await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);
    expect(d.server.close).toHaveBeenCalledTimes(1);
    expect(d.exit).toHaveBeenCalledTimes(1);
  });

  it("names the signal in its log line", async () => {
    const d = deps();
    await createShutdown(d)("SIGTERM");
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining("SIGTERM"));
  });
});
