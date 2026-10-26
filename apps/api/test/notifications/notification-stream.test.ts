import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { createContainer } from "../../src/composition/create-container.js";
import {
  createNotificationHub,
  createNotificationRouter,
  createNotificationUseCases,
} from "../../src/modules/notifications/index.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs, type SignedIn } from "../helpers/auth.js";

interface StreamEvent {
  readonly event: string;
  readonly data: unknown;
}

const servers: Server[] = [];

async function serve(app: express.Express): Promise<string> {
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function openStream(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const response = await fetch(url, { headers, signal: controller.signal });
  const events: StreamEvent[] = [];
  const comments: string[] = [];
  const decoder = new TextDecoder();
  let buffer = "";
  const reader = response.body!.getReader();
  const finished = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      for (let end = buffer.indexOf("\n\n"); end >= 0; end = buffer.indexOf("\n\n")) {
        const lines = buffer.slice(0, end).split("\n");
        buffer = buffer.slice(end + 2);
        comments.push(...lines.filter((line) => line.startsWith(":")).map((line) => line.slice(1).trim()));
        const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
        const data = lines.find((line) => line.startsWith("data: "))?.slice(6);
        if (event) events.push({ event, data: data === undefined ? undefined : JSON.parse(data) });
      }
    }
  })().catch(() => {});
  return { response, events, comments, finished, close: () => controller.abort() };
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

afterAll(() => prisma.$disconnect());

describe("the notification stream of the API", () => {
  const container = createContainer();
  const app = createApp({ container });
  let base: string;
  let anna: SignedIn;
  let boris: SignedIn;
  let vera: SignedIn;
  let projectId: string;

  beforeEach(async () => {
    await resetDb();
    anna = await signInAs("Анна");
    boris = await signInAs("Борис");
    vera = await signInAs("Вера");
    ({ projectId } = await seedProject("unused", "Клиника"));
    base = await serve(app);
  });

  afterEach(() => container.closeNotificationStreams());

  it("opens as an unbuffered event stream with a ready event", async () => {
    const stream = await openStream(`${base}/api/notifications/stream`, boris.auth);

    expect(stream.response.status).toBe(200);
    expect(stream.response.headers.get("content-type")).toMatch(/^text\/event-stream/);
    expect(stream.response.headers.get("x-accel-buffering")).toBe("no");
    expect(stream.response.headers.get("cache-control")).toBe("no-cache, no-transform");
    await vi.waitFor(() => expect(stream.events[0]).toEqual({ event: "ready", data: {} }));
  });

  it("carries a notification to its recipient as it is created, and nothing to anyone else", async () => {
    const toBoris = await openStream(`${base}/api/notifications/stream`, boris.auth);
    const toVera = await openStream(`${base}/api/notifications/stream`, vera.auth);
    await vi.waitFor(() => {
      expect(toBoris.events).toHaveLength(1);
      expect(toVera.events).toHaveLength(1);
    });

    const task = await request(app).post("/api/tasks").set(anna.auth)
      .send({ projectId, title: "Позвонить клиенту", priority: "MEDIUM", participantIds: [boris.membership!.id] });
    expect(task.status).toBe(201);

    await vi.waitFor(() => expect(toBoris.events).toHaveLength(2));
    expect(toBoris.events[1]).toEqual({
      event: "notification",
      data: {
        id: expect.any(String), kind: "TASK_ASSIGNED", createdAt: expect.any(String), readAt: null,
        project: { id: projectId, name: "Клиника" },
        task: { id: task.body.id, title: "Позвонить клиенту", projectId, dueDate: null, dueTime: null },
        document: null,
        actor: { name: "Анна" },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(toVera.events).toEqual([{ event: "ready", data: {} }]);
  });

  it("answers 401 without a session", async () => {
    const stream = await openStream(`${base}/api/notifications/stream`);

    expect(stream.response.status).toBe(401);
  });

  it("ends when the API closes its streams", async () => {
    const stream = await openStream(`${base}/api/notifications/stream`, boris.auth);
    await vi.waitFor(() => expect(stream.events).toHaveLength(1));

    container.closeNotificationStreams();

    await expect(stream.finished).resolves.toBeUndefined();
  });
});

describe("the notification stream's upkeep", () => {
  it("keeps the connection alive and lets go of the member once the client leaves", async () => {
    const hub = createNotificationHub();
    const useCases = createNotificationUseCases({
      notifications: {
        createMany: async () => [], refreshUnread: async () => null, latest: async () => [], unreadCount: async () => 0,
        markRead: async () => true, markAllRead: async () => {},
      },
      recipients: { staffReaching: async () => [], activeMembers: async () => [] },
      standings: { read: async () => null },
      claims: { claim: async () => false },
      dueTasks: { dueBetween: async () => [], claim: async () => false },
      hub,
      relay: { forward: () => undefined },
      clock: { now: () => new Date() },
      timeZone: "Europe/Minsk",
    });
    const app = express();
    app.use((req, _res, next) => {
      req.actor = { userId: "u1", membershipId: "m1", orgId: "org1", role: "ADMIN" };
      next();
    });
    app.use("/notifications", createNotificationRouter(useCases, { keepaliveMs: 20 }));
    const base = await serve(app);

    const stream = await openStream(`${base}/notifications/stream`);
    await vi.waitFor(() => expect(stream.comments.filter((comment) => comment === "keepalive").length).toBeGreaterThan(1));
    expect(hub.size()).toBe(1);

    stream.close();

    await vi.waitFor(() => expect(hub.size()).toBe(0));
  });
});
