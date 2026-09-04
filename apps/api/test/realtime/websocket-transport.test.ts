import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import WebSocket from "ws";
import { createConnectionRegistry } from "../../src/modules/realtime/index.js";
import { attachRealtime, REALTIME_PATH } from "../../src/modules/realtime/infrastructure/websocket-transport.js";
import { AppError } from "../../src/shared/domain/app-error.js";
import type { SessionPrincipal } from "../../src/modules/identity/index.js";

const VALID = "valid-token";
const principal = { userId: "u1" } as SessionPrincipal;

let open: Array<{ close: () => Promise<void> }> = [];

async function harness() {
  const registry = createConnectionRegistry();
  const server: Server = createServer();
  const authenticate = vi.fn(async (token: string) => {
    if (token !== VALID) throw new AppError("unauthorized", "Authentication required");
    return principal;
  });
  const realtime = attachRealtime({ server, registry, authenticate });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  const handle = {
    close: async () => {
      await realtime.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
  open.push(handle);
  return { registry, authenticate, port, realtime };
}

function connect(port: number, token?: string) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${REALTIME_PATH}`, {
    headers: token === undefined ? {} : { cookie: `adpulse_access=${token}` },
  });
  const settled = new Promise<{ refused?: number; message?: unknown }>((resolve) => {
    socket.on("message", (data) => resolve({ message: JSON.parse(String(data)) }));
    socket.on("unexpected-response", (_request, response) => resolve({ refused: response.statusCode }));
    socket.on("error", () => resolve({ refused: 0 }));
  });
  return { socket, settled };
}

afterEach(async () => {
  for (const handle of open) await handle.close();
  open = [];
});

describe("the realtime handshake", () => {
  it("accepts a connection that presents a valid token", async () => {
    const { port, registry } = await harness();
    const { settled } = connect(port, VALID);

    expect(await settled).toEqual({ message: { kind: "ready" } });
    expect(registry.size()).toBe(1);
  });

  it.each([
    ["an unknown token", "wrong-token"],
    ["an empty cookie", ""],
    ["no cookie at all", undefined],
  ])("refuses the upgrade on %s without revealing why", async (_name, token) => {
    const { port, registry } = await harness();
    const { settled } = connect(port, token);

    expect(await settled).toEqual({ refused: 401 });
    expect(registry.size()).toBe(0);
  });

  it("ignores a cookie header that carries no access cookie", async () => {
    const { port, registry } = await harness();
    const socket = new WebSocket(`ws://127.0.0.1:${port}${REALTIME_PATH}`, {
      headers: { cookie: "theme=dark; adpulse_session=1" },
    });
    const refused = new Promise<number | undefined>((resolve) => {
      socket.on("unexpected-response", (_request, response) => resolve(response.statusCode));
      socket.on("open", () => resolve(undefined));
    });

    expect(await refused).toBe(401);
    expect(registry.size()).toBe(0);
  });

  it("ignores upgrades on another path", async () => {
    const { port } = await harness();
    const socket = new WebSocket(`ws://127.0.0.1:${port}/somewhere-else`);
    const failed = new Promise<boolean>((resolve) => {
      socket.on("error", () => resolve(true));
      socket.on("open", () => resolve(false));
    });

    expect(await failed).toBe(true);
  });

  it("removes the connection from the registry when the socket closes", async () => {
    const { port, registry } = await harness();
    const { socket, settled } = connect(port, VALID);
    await settled;
    expect(registry.size()).toBe(1);

    socket.close();
    await vi.waitFor(() => expect(registry.size()).toBe(0));
  });

  it("delivers a published event to the connected socket", async () => {
    const { port, registry } = await harness();
    const { socket, settled } = connect(port, VALID);
    await settled;

    const received = new Promise((resolve) => socket.on("message", (data) => resolve(JSON.parse(String(data)))));
    registry.list()[0]!.send({
      kind: "task.deleted", orgId: "org1", projectId: "p1", taskId: "t1",
    });

    expect(await received).toEqual({
      kind: "task.deleted", orgId: "org1", projectId: "p1", taskId: "t1",
    });
  });

  it("registers the connection only once the upgrade is accepted", async () => {
    const { port, registry, authenticate } = await harness();
    const { settled } = connect(port, VALID);
    await settled;

    expect(authenticate).toHaveBeenCalledWith(VALID);
    expect(registry.size()).toBe(1);
  });

  it("closes every open socket on shutdown", async () => {
    const { port, realtime, registry } = await harness();
    const { socket, settled } = connect(port, VALID);
    await settled;

    const closed = new Promise<number>((resolve) => socket.on("close", resolve));
    await realtime.close();

    expect(await closed).toBe(1001);
    expect(registry.size()).toBe(0);
  });
});
