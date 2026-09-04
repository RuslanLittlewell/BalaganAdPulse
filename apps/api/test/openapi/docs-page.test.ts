import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";

const app = createApp();

const withdrawnApp = async () => {
  vi.resetModules();
  vi.stubEnv("API_DOCS", "off");
  const { createApp: createWithdrawnApp } = await import("../../src/composition/app.js");
  return createWithdrawnApp();
};

describe("GET /api/docs", () => {
  it("serves a page that loads the document", async () => {
    const response = await request(app).get("/api/docs");
    expect(response.status).toBe(200);
    expect(response.type).toBe("text/html");
    expect(response.text).toContain("/api/openapi.json");
    expect(response.text).toContain("SwaggerUIBundle");
  });

  it("serves the same page with a trailing slash", async () => {
    const response = await request(app).get("/api/docs/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("SwaggerUIBundle");
  });

  it("serves the assets the page asks for, from the API itself", async () => {
    const stylesheet = await request(app).get("/api/docs/swagger-ui.css");
    expect(stylesheet.status).toBe(200);
    expect(stylesheet.type).toBe("text/css");

    const script = await request(app).get("/api/docs/swagger-ui-bundle.js");
    expect(script.status).toBe(200);
    expect(script.text.length).toBeGreaterThan(1000);
  });

  it("needs no session", async () => {
    const response = await request(app).get("/api/docs").set("Cookie", "");
    expect(response.status).toBe(200);
  });
});

describe("with API_DOCS=off", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("answers as it does for a path it has never served", async () => {
    const withdrawn = await withdrawnApp();
    const unserved = await request(withdrawn).get("/api/nothing-is-mounted-here");
    for (const path of ["/api/openapi.json", "/api/docs"]) {
      const response = await request(withdrawn).get(path);
      expect(response.status, path).toBe(unserved.status);
      expect(response.body, path).toEqual(unserved.body);
    }
  });

  it("still serves both while the variable is unset", async () => {
    for (const path of ["/api/openapi.json", "/api/docs"]) {
      expect((await request(app).get(path)).status, path).toBe(200);
    }
  });

  it("leaves the rest of the API answering as it did", async () => {
    const withdrawn = await withdrawnApp();
    const response = await request(withdrawn).get("/healthz");
    expect(response.status).toBe(200);
  });
});
