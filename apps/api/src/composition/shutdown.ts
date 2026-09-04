export interface Drainable {
  close(callback: (error?: Error) => void): void;
}

export interface ShutdownDeps {
  server: Drainable;
  closeRealtime?: () => Promise<void>;
  disconnect: () => Promise<void>;
  exit: (code: number) => void;
  log?: (message: string) => void;
}

export function createShutdown(deps: ShutdownDeps): (signal: string) => Promise<void> {
  const log = deps.log ?? ((message: string) => console.log(message));
  let started = false;

  return async function shutdown(signal: string): Promise<void> {
    if (started) return;
    started = true;
    log(`${signal} received, draining connections`);

    await deps.closeRealtime?.().catch((error: unknown) => {
      console.error("Error while closing realtime connections:", error);
    });

    const closeError = await new Promise<Error | undefined>((resolve) => {
      deps.server.close(resolve);
    });
    if (closeError) console.error("Error while closing the server:", closeError);

    await deps.disconnect();
    deps.exit(closeError ? 1 : 0);
  };
}
