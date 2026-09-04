import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { ACCESS_COOKIE } from "../../identity/index.js";
import type { SessionPrincipal } from "../../identity/index.js";
import type { TaskEvent } from "../../tasks/index.js";
import type { ConnectionRegistry } from "../application/connection-registry.js";

export const REALTIME_PATH = "/api/realtime";

const GOING_AWAY = 1001;

export interface RealtimeTransportDependencies {
  readonly server: Server;
  readonly registry: ConnectionRegistry;
  readonly authenticate: (accessToken: string) => Promise<SessionPrincipal>;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function attachRealtime(dependencies: RealtimeTransportDependencies) {
  const sockets = new WebSocketServer({ noServer: true });

  const refuse = (socket: Duplex) => {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
  };

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (pathname !== REALTIME_PATH) {
      socket.destroy();
      return;
    }

    const accessToken = readCookie(request.headers.cookie, ACCESS_COOKIE);
    if (!accessToken) {
      refuse(socket);
      return;
    }

    dependencies
      .authenticate(accessToken)
      .then((principal) => {
        sockets.handleUpgrade(request, socket, head, (client) => {
          const handle = dependencies.registry.add({
            principal,
            send: (event: TaskEvent) => {
              if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
            },
          });
          client.on("close", () => handle.remove());
          client.on("error", () => handle.remove());
          client.send(JSON.stringify({ kind: "ready" }));
        });
      })
      .catch(() => { refuse(socket); });
  };

  dependencies.server.on("upgrade", onUpgrade);

  return {
    async close(): Promise<void> {
      dependencies.server.off("upgrade", onUpgrade);
      for (const client of sockets.clients) client.close(GOING_AWAY);
      dependencies.registry.clear();
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
    },
  };
}

export type RealtimeTransport = ReturnType<typeof attachRealtime>;
