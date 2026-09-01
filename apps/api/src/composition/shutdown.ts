export interface Drainable {
  close(callback: (error?: Error) => void): void;
}

export interface ShutdownDeps {
  server: Drainable;
  /** Closes live WebSocket connections. Optional so a caller that runs no
   * realtime transport (a test, a CLI) need not supply one. */
  closeRealtime?: () => Promise<void>;
  disconnect: () => Promise<void>;
  exit: (code: number) => void;
  log?: (message: string) => void;
}

/** Stops accepting connections, lets in-flight requests finish, closes the
 * database pool, and exits.
 *
 * Dependencies are injected rather than imported so this can be tested without
 * listening on a port or signalling a real process. */
export function createShutdown(deps: ShutdownDeps): (signal: string) => Promise<void> {
  const log = deps.log ?? ((message: string) => console.log(message));
  let started = false;

  return async function shutdown(signal: string): Promise<void> {
    // A second signal during the drain must not exit twice, and must not cut
    // the first drain short.
    if (started) return;
    started = true;
    log(`${signal} received, draining connections`);

    // First, and before the server stops accepting: an open socket keeps the
    // server's close callback pending indefinitely, so the drain would run out
    // the platform's grace period and end in a SIGKILL instead of a clean exit.
    // A failure here must not strand the pool, so it is logged and passed over.
    await deps.closeRealtime?.().catch((error: unknown) => {
      console.error("Error while closing realtime connections:", error);
    });

    const closeError = await new Promise<Error | undefined>((resolve) => {
      deps.server.close(resolve);
    });
    if (closeError) console.error("Error while closing the server:", closeError);

    // Runs even after a close error: an open pool would keep the process alive
    // past the platform's grace period and earn a SIGKILL.
    await deps.disconnect();
    deps.exit(closeError ? 1 : 0);
  };
}
