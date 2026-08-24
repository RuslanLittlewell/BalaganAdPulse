import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { signAccessToken } from "../src/auth/token.js";

const webDistPath = fileURLToPath(new URL("./fixtures/web-dist/", import.meta.url));
const app = createApp({ webDistPath });

// requireAuth verifies the signature only — no database lookup — so a signed
// token is enough here and this file stays database-free like the rest of it.
let auth: { Authorization: string };
beforeAll(async () => {
  auth = {
    Authorization: `Bearer ${await signAccessToken({
      sub: "00000000-0000-0000-0000-000000000000",
      name: "Test",
      email: "test@example.com",
    })}`,
  };
});

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
    // A hard refresh on /login must not 404: the SPA owns that path.
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
    // requireAuth closes every /api path before the catch-all runs, so an
    // unauthenticated request never learns whether the route exists — it
    // gets the same 401 envelope either way. What this proves is that the
    // SPA fallback never intercepts it and returns HTML instead.
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toEqual(expect.any(String));
  });

  it("answers an authenticated unknown /api path with the json envelope, not html", async () => {
    // Past requireAuth, an unmatched /api path reaches the catch-all and
    // gets a 404 envelope. If the fallback swallowed this instead, a
    // mistyped endpoint would answer 200 with HTML and the frontend would
    // read a routing mistake as a corrupt response.
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
