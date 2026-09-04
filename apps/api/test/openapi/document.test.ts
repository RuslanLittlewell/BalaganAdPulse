import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";

const app = createApp();

const documentOf = async () => {
  const response = await request(app).get("/api/openapi.json");
  expect(response.status).toBe(200);
  return response.body;
};

const refsIn = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(refsIn);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    key === "$ref" && typeof nested === "string" ? [nested] : refsIn(nested));
};

const resolve = (document: unknown, pointer: string): unknown =>
  pointer.slice(2).split("/").reduce<unknown>(
    (node, segment) => (node as Record<string, unknown> | undefined)?.[segment.replace(/~1/g, "/")],
    document,
  );

describe("GET /api/openapi.json", () => {
  it("answers an OpenAPI 3.1 document without a token", async () => {
    const response = await request(app).get("/api/openapi.json");
    expect(response.status).toBe(200);
    expect(response.type).toBe("application/json");
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.info).toMatchObject({ title: expect.any(String), version: expect.any(String) });
    expect(response.body.servers).toEqual([{ url: "/" }]);
  });

  it("describes something under every tag it announces", async () => {
    const document = await documentOf();
    const tagged = new Set(
      Object.values(document.paths as Record<string, Record<string, { tags: string[] }>>)
        .flatMap((path) => Object.values(path).flatMap((operation) => operation.tags)),
    );
    expect([...tagged].sort()).toEqual(
      (document.tags as { name: string }[]).map(({ name }) => name).sort(),
    );
  });

  it("resolves every reference it makes", async () => {
    const document = await documentOf();
    const pointers = [...new Set(refsIn(document))];
    expect(pointers.length).toBeGreaterThan(0);
    for (const pointer of pointers) {
      expect(pointer.startsWith("#/")).toBe(true);
      expect(resolve(document, pointer), `${pointer} does not resolve`).toBeDefined();
    }
  });

  it("declares the session cookie and the bearer token, and requires one by default", async () => {
    const document = await documentOf();
    expect(document.components.securitySchemes).toMatchObject({
      sessionCookie: { type: "apiKey", in: "cookie", name: "adpulse_access" },
      bearerAuth: { type: "http", scheme: "bearer" },
    });
    expect(document.security).toEqual([{ sessionCookie: [] }, { bearerAuth: [] }]);
    expect(document.paths["/api/projects"].get.security).toBeUndefined();
  });

  it("leaves the endpoints a caller reaches without a session open", async () => {
    const document = await documentOf();
    const open: [string, string][] = [
      ["/api/auth/register", "post"],
      ["/api/auth/login", "post"],
      ["/api/auth/refresh", "post"],
      ["/api/auth/logout", "post"],
      ["/api/regustration/{code}", "get"],
    ];
    for (const [path, method] of open) {
      expect(document.paths[path]?.[method]?.security, `${method} ${path}`).toEqual([]);
    }
  });

  it("gives every operation a summary, a tag and a described success", async () => {
    const document = await documentOf();
    const operations = Object.entries(document.paths as Record<string, Record<string, {
      summary?: string; tags?: string[]; responses: Record<string, { description?: string }>;
    }>>).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({ where: `${method} ${path}`, operation })));
    expect(operations.length).toBeGreaterThan(20);
    for (const { where, operation } of operations) {
      expect(operation.summary, where).toBeTruthy();
      expect(operation.tags?.length, where).toBe(1);
      const success = Object.keys(operation.responses).find((status) => status.startsWith("2"));
      expect(success, where).toBeDefined();
      expect(operation.responses[success!].description, where).toBeTruthy();
    }
  });

  it("describes the error envelope every failure shares", async () => {
    const document = await documentOf();
    expect(document.components.schemas.Error).toMatchObject({
      type: "object",
      properties: { error: { type: "object", required: ["message"] } },
      required: ["error"],
    });
  });
});

describe("the document as a client generator reads it", () => {
  it("names every operation, once", async () => {
    const document = await documentOf();
    const ids = Object.values(document.paths as Record<string, Record<string, { operationId: string }>>)
      .flatMap((methods) => Object.values(methods).map((operation) => operation.operationId));
    expect(ids.every((id) => /^[a-z][A-Za-z0-9]*$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("says what each tag covers", async () => {
    const document = await documentOf();
    for (const tag of document.tags as { name: string; description?: string }[]) {
      expect(tag.description, tag.name).toBeTruthy();
    }
  });
});
