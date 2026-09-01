import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { ACCESS_COOKIE } from "../../identity/index.js";
import type { SessionPrincipal } from "../../identity/index.js";
import type { TaskEvent } from "../../tasks/index.js";
import type { ConnectionRegistry } from "../application/connection-registry.js";

/** Where the board connects. Under `/api`, so the same proxy rule and platform
 * route that reach the REST endpoints reach this too. */
export const REALTIME_PATH = "/api/realtime";

// The cookie name comes from identity rather than being repeated here: a
// rename there must not leave the socket authenticating against a cookie that
// no longer exists, which would fail silently as "nobody is entitled".

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

/**
 * The WebSocket endpoint for the board.
 *
 * Authentication happens **during the upgrade, from the session cookie** — the
 * same HttpOnly cookie the REST API reads. A browser attaches it to the upgrade
 * request automatically, and the page itself cannot read it, so there is
 * nothing for the client to send and nothing to leak: no token in the request
 * line for proxy logs to record, and no window in which an accepted socket is
 * still unauthenticated.
 *
 * A refused upgrade is answered with a bare 401 and the connection destroyed.
 * Unknown, expired, tampered, malformed and absent all look identical from
 * outside, exactly as they do on the REST path.
 */
export function attachRealtime(dependencies: RealtimeTransportDependencies) {
  const sockets = new WebSocketServer({ noServer: true });

  const refuse = (socket: Duplex) => {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
  };

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    // The host is irrelevant here; only the path decides.
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (pathname !== REALTIME_PATH) {
      // Nothing else here serves WebSockets. Left alone, the socket would hang
      // open with the client waiting on a handshake that never comes, and it
      // would keep the HTTP server from closing on shutdown.
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
          // Both, because an errored socket may never emit a close, and would
          // otherwise stay in the registry and be sent to forever.
          client.on("close", () => handle.remove());
          client.on("error", () => handle.remove());
          // The board has nothing to say: this is a one-way feed, so incoming
          // frames are ignored rather than parsed.
          client.send(JSON.stringify({ kind: "ready" }));
        });
      })
      .catch(() => { refuse(socket); });
  };

  dependencies.server.on("upgrade", onUpgrade);

  return {
    /** Closes every open socket, then the server, so a redeploy does not leave
     * boards waiting on a connection that will never speak again. */
    async close(): Promise<void> {
      dependencies.server.off("upgrade", onUpgrade);
      for (const client of sockets.clients) client.close(GOING_AWAY);
      dependencies.registry.clear();
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
    },
  };
}

export type RealtimeTransport = ReturnType<typeof attachRealtime>;
