import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/composition/app.js";
import { prisma } from "../src/shared/infrastructure/prisma.js";
import { resetDb } from "./helpers/db.js";
import { signInAs } from "./helpers/auth.js";

const webDistPath = fileURLToPath(new URL("./fixtures/web-dist/", import.meta.url));
const app = createApp({ webDistPath });

let auth: { Authorization: string };
beforeAll(async () => {
  await resetDb();
  ({ auth } = await signInAs());
});
afterAll(async () => { await prisma.$disconnect(); });

describe("SPA serving", () => {
  it("serves index.html at the root", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root"></div>');
  });

  it("serves a built asset", async () => {
    const res = await request(app).get("/assets/app.js");
    expect(res.status).toBe(200);
    expect(res.text).toContain("spa-fixture");
  });

  it("falls back to index.html on a client-side route", async () => {
    const res = await request(app).get("/login");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root"></div>');
  });

  it("falls back on a nested client-side route", async () => {
    const res = await request(app).get("/clients/some-uuid/campaigns");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root"></div>');
  });

  it("answers an unauthenticated unknown /api path with the json envelope, not html", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toEqual(expect.any(String));
  });

  it("answers an authenticated unknown /api path with the json envelope, not html", async () => {
    const res = await request(app).get("/api/does-not-exist").set(auth);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Endpoint not found");
  });

  it("leaves /healthz alone", async () => {
    const res = await request(app).get("/healthz");
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("createApp without a build present", () => {
  it("mounts no static layer, so the api still behaves", async () => {
    const bare = createApp({ webDistPath: "/nonexistent/web/dist" });
    const res = await request(bare).get("/");
    expect(res.status).toBe(404);
  });
});
