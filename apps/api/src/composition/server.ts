import "dotenv/config";
import { createApp } from "./app.js";
import { createContainer } from "./create-container.js";
import { prisma } from "../shared/infrastructure/prisma.js";
import { attachRealtime } from "../modules/realtime/infrastructure/websocket-transport.js";
import { createShutdown } from "./shutdown.js";

const port = Number(process.env.PORT ?? 3000);
const container = createContainer();
const app = createApp({ container });

const server = app.listen(port, () => {
  console.log(`AdPulse API listening on http://localhost:${port}`);
});

// The board's live feed shares the HTTP server, so it needs no second port and
// travels through whatever route already reaches the API.
const realtime = attachRealtime({
  server,
  registry: container.connections,
  authenticate: container.authenticate,
});

const shutdown = createShutdown({
  server,
  closeRealtime: () => realtime.close(),
  disconnect: () => prisma.$disconnect(),
  exit: (code) => process.exit(code),
});

// A rejection here (e.g. prisma.$disconnect() failing) must still end in a
// deliberate exit, not an uncaught-exception crash.
const onSignal = (signal: string) =>
  shutdown(signal).catch((error: unknown) => {
    console.error("Error during shutdown:", error);
    process.exit(1);
  });

// SIGTERM is what the platform sends when a replacement instance goes live.
process.on("SIGTERM", () => void onSignal("SIGTERM"));
process.on("SIGINT", () => void onSignal("SIGINT"));
