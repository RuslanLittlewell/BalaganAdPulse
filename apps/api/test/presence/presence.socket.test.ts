import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import WebSocket from "ws";
import { createConnectionRegistry, createPresenceDelivery } from "../../src/modules/realtime/index.js";
import { createPresenceRegistry } from "../../src/modules/presence/index.js";
import type { PresencePerson } from "../../src/modules/presence/index.js";
import { attachRealtime, REALTIME_PATH } from "../../src/modules/realtime/infrastructure/websocket-transport.js";
import type { SessionPrincipal } from "../../src/modules/identity/index.js";

const TOKEN = "valid-token";
const viewer = { id: "u1", name: "Buyer", email: "buyer@example.com" } as SessionPrincipal;

const person = (userId: string, fields: Partial<PresencePerson> = {}): PresencePerson => ({
  userId,
  membershipId: `m-${userId}`,
  orgId: "org-1",
  role: "MANAGER",
  name: `Имя ${userId}`,
  image: null,
  clientIds: [],
  ...fields,
});

let open: Array<() => Promise<void>> = [];

async function harness() {
  const connections = createConnectionRegistry();
  const presence = createPresenceRegistry();
  const delivery = createPresenceDelivery({
    connections,
    presence,
    members: {
      resolveActor: async () =>
        ({ userId: "u1", membershipId: "m-u1", orgId: "org-1", role: "ADMIN" }),
    },
    clients: { reachableIds: async () => [] },
  });
  const server: Server = createServer();
  const realtime = attachRealtime({
    server,
    registry: connections,
    authenticate: vi.fn(async () => viewer),
    greet: (connection) => { void delivery.greet(connection); },
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  open.push(async () => {
    await realtime.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return { port, presence, delivery };
}

function listen(port: number) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${REALTIME_PATH}`, {
    headers: { cookie: `adpulse_access=${TOKEN}` },
  });
  const received: unknown[] = [];
  socket.on("message", (data) => { received.push(JSON.parse(String(data))); });
  const closed = new Promise<void>((resolve) => socket.on("close", () => resolve()));
  return {
    received,
    socket,
    closed,
    async waitFor(count: number) {
      await vi.waitFor(() => { expect(received.length).toBeGreaterThanOrEqual(count); });
      return received;
    },
  };
}

afterEach(async () => {
  for (const close of open) await close();
  open = [];
});

describe("presence over a real connection", () => {
  it("hands the roster to a session as it opens", async () => {
    const { port, presence } = await harness();
    presence.join(person("u2", { name: "Мария" }));

    const session = listen(port);

    expect(await session.waitFor(2)).toEqual([
      { kind: "ready" },
      { kind: "presence.state", people: [{ userId: "u2", membershipId: "m-u2", name: "Мария", image: null }] },
    ]);
    session.socket.close();
    await session.closed;
  });

  it("carries an arrival and a departure to an open session", async () => {
    const { port, delivery } = await harness();
    const session = listen(port);
    await session.waitFor(2);

    await delivery.deliverJoined(person("u3", { name: "Пётр" }));
    await delivery.deliverLeft(person("u3"));

    expect(await session.waitFor(4)).toMatchObject([
      { kind: "ready" },
      { kind: "presence.state" },
      { kind: "presence.joined", person: { userId: "u3", name: "Пётр" } },
      { kind: "presence.left", userId: "u3" },
    ]);
    session.socket.close();
    await session.closed;
  });
});
