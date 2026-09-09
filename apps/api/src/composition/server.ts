import "dotenv/config";
import { createApp } from "./app.js";
import { createContainer } from "./create-container.js";
import { prisma } from "#shared/infrastructure/prisma.js";
import { attachRealtime } from "../modules/realtime/infrastructure/websocket-transport.js";
import { PRESENCE_SWEEP_MS } from "../modules/presence/index.js";
import { createShutdown } from "./shutdown.js";

const port = Number(process.env.PORT ?? 3000);
const container = createContainer();
const app = createApp({ container });

const server = app.listen(port, () => {
  console.log(`AdPulse API listening on http://localhost:${port}`);
});

const realtime = attachRealtime({
  server,
  registry: container.connections,
  authenticate: container.authenticate,
  greet: container.greetPresence,
});

container.importWorker.start();

const presenceSweep = setInterval(() => { container.sweepPresence(); }, PRESENCE_SWEEP_MS);

const shutdown = createShutdown({
  server,
  stopTimers: () => { clearInterval(presenceSweep); },
  closeRealtime: () => realtime.close(),
  disconnect: async () => { await container.importWorker.stop(); await prisma.$disconnect(); },
  exit: (code) => process.exit(code),
});

const onSignal = (signal: string) =>
  shutdown(signal).catch((error: unknown) => {
    console.error("Error during shutdown:", error);
    process.exit(1);
  });

process.on("SIGTERM", () => void onSignal("SIGTERM"));
process.on("SIGINT", () => void onSignal("SIGINT"));
