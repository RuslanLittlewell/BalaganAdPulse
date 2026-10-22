import { fileURLToPath } from "node:url";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { landingFor } from "../../api/src/composition/landing";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const app = express();
app.use(landingFor("bi.balagan.pro", root));
app.use((_req, res) => res.send("other host"));
const get = (path: string) => request(app).get(path).set("Host", "bi.balagan.pro");

describe("the built landing's security policy", () => {
  it.each(["/", "/privacy/", "/404.html", "/missing"])('protects %s, including error pages', async (path) => {
    const res = await get(path);
    expect(res.status).toBe(path === "/missing" ? 404 : 200);
    const policy = res.headers["content-security-policy"];
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("require-trusted-types-for 'script'");
    expect(policy).toContain("trusted-types 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    const scriptPolicy = policy.match(/(?:^|;)\s*script-src ([^;]+)/)![1];
    expect(scriptPolicy).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();

    const nonce = scriptPolicy.match(/'nonce-([^']+)'/)![1];
    expect(Buffer.from(nonce, "base64").length).toBeGreaterThanOrEqual(16);
    const tags = [...res.text.matchAll(/<(?:script|style)\b([^>]*)>/g)];
    expect(tags.length).toBeGreaterThan(0);
    for (const [, attrs] of tags) {
      expect(attrs).toContain(`nonce="${nonce}"`);
    }
  });

  it("never reuses a nonce, even with conditional requests, and protects HEAD", async () => {
    const initial = await get("/");
    const cached = await get("/").set("If-None-Match", initial.headers.etag);
    expect(cached.status).toBe(200);
    expect(cached.headers["content-security-policy"]).not.toBe(initial.headers["content-security-policy"]);
    expect(cached.headers["cache-control"]).toBe("private, no-store");
    const head = await request(app).head("/").set("Host", "bi.balagan.pro");
    expect(head.status).toBe(200);
    expect(head.headers["content-security-policy"]).toContain("'nonce-");
    expect(head.text).toBeUndefined();
  });

  it("preserves static page routes and redirects without reflecting HTML input", async () => {
    const bare = await get("/privacy?from=footer");
    expect(bare.status).toBe(301);
    expect(bare.headers.location).toBe("/privacy/?from=footer");
    for (const path of ["/privacy/", "/privacy/index.html", "/index.html"]) {
      expect((await get(path)).status).toBe(200);
    }
    const res = await get("/?message=%3Cscript%3Ealert(1)%3C/script%3E");
    expect(res.text).not.toContain("alert(1)");
  });

  it("serves scripts as JavaScript and keeps missing paths out of the index", async () => {
    const home = await get("/");
    const src = home.text.match(/<script[^>]*src="([^"]+)"/)![1];
    const script = await get(src);
    expect(script.status).toBe(200);
    expect(script.headers["content-type"]).toContain("javascript");
    expect((await get("/missing")).headers["x-robots-tag"]).toBe("noindex");
  });

  it("leaves the application's host policies alone", async () => {
    const res = await request(app).get("/").set("Host", "app.balagan.pro");
    expect(res.text).toBe("other host");
    expect(res.headers["content-security-policy"]).toBeUndefined();
    expect(res.headers["cross-origin-opener-policy"]).toBeUndefined();
  });
});
