import { afterAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/composition/app.js";
import { prisma } from "../src/shared/infrastructure/prisma.js";

const webDistPath = fileURLToPath(new URL("./fixtures/web-dist/", import.meta.url));
const landingDistPath = fileURLToPath(new URL("./fixtures/landing-dist/", import.meta.url));
const app = createApp({ webDistPath, landingDistPath, landingHost: "bi.balagan.pro" });
afterAll(async () => { await prisma.$disconnect(); });

const onLanding = (path: string) => request(app).get(path).set("Host", "bi.balagan.pro");

describe("the landing host", () => {
  it("answers its root with the landing's home page, not the web app", async () => {
    const res = await onLanding("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("landing-home-fixture");
    expect(res.text).not.toContain('<div id="root"></div>');
  });

  it("serves the privacy policy with or without the trailing slash", async () => {
    expect((await onLanding("/privacy/")).text).toContain("landing-privacy-fixture");
    const bare = await onLanding("/privacy");
    expect([200, 301]).toContain(bare.status);
    if (bare.status === 301) expect(bare.headers.location).toBe("/privacy/");
  });

  it("answers a path it does not have with its not-found page and 404", async () => {
    const res = await onLanding("/pricing");
    expect(res.status).toBe(404);
    expect(res.text).toContain("landing-missing-fixture");
  });

  it("offers no API", async () => {
    const res = await onLanding("/api/projects");
    expect(res.status).toBe(404);
    expect(res.text).toContain("landing-missing-fixture");
  });

  it("still answers the health check", async () => {
    expect((await onLanding("/healthz")).body).toEqual({ status: "ok" });
  });

  it("is told apart from the app host whatever the case of the name", async () => {
    const res = await request(app).get("/").set("Host", "BI.Balagan.pro");
    expect(res.text).toContain("landing-home-fixture");
  });
});

describe("every other host", () => {
  it("still gets the web app at its root", async () => {
    const res = await request(app).get("/").set("Host", "app.balagan.pro");
    expect(res.text).toContain('<div id="root"></div>');
  });

  it("still gets the web app's client-side routes", async () => {
    const res = await request(app).get("/privacy").set("Host", "app.balagan.pro");
    expect(res.text).toContain('<div id="root"></div>');
  });

  it("still reaches the API", async () => {
    const res = await request(app).get("/api/does-not-exist").set("Host", "app.balagan.pro");
    expect(res.status).toBe(401);
  });
});

describe("without a landing host", () => {
  it("serves no landing at all", async () => {
    const plain = createApp({ webDistPath, landingDistPath, landingHost: null });
    const res = await request(plain).get("/").set("Host", "bi.balagan.pro");
    expect(res.text).toContain('<div id="root"></div>');
  });
});
