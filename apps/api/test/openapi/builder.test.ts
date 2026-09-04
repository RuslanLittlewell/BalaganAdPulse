import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  arrayOf,
  buildOpenApiDocument,
  mergeComponents,
  ref,
  type RouteGroupDoc,
} from "../../src/shared/presentation/openapi.js";

const info = { title: "AdPulse API", version: "0.1.0" };

const group = (mount: string, operations: RouteGroupDoc["operations"]): RouteGroupDoc => ({
  mount,
  tag: "Projects",
  operations,
});

describe("the OpenAPI document builder", () => {
  it("announces OpenAPI 3.1 and the /api server", () => {
    const document = buildOpenApiDocument({ info, groups: [] });
    expect(document.openapi).toBe("3.1.0");
    expect(document.info).toMatchObject(info);
    expect(document.servers).toEqual([{ url: "/" }]);
  });

  it("joins a mount to an operation path and rewrites express parameters", () => {
    const document = buildOpenApiDocument({
      info,
      groups: [
        group("/api/projects", [
          { method: "get", path: "/", summary: "List projects", success: { status: 200, description: "The projects" } },
          { method: "get", path: "/:id", summary: "Read a project", success: { status: 200, description: "The project" } },
        ]),
        group("/api/projects/:projectId", [
          { method: "get", path: "/campaigns/names", summary: "Name the campaigns", success: { status: 200, description: "The campaigns" } },
        ]),
      ],
    });
    expect(Object.keys(document.paths).sort()).toEqual([
      "/api/projects",
      "/api/projects/{id}",
      "/api/projects/{projectId}/campaigns/names",
    ]);
  });

  it("declares every path parameter it finds in the joined path", () => {
    const document = buildOpenApiDocument({
      info,
      groups: [group("/api/projects/:projectId", [
        { method: "get", path: "/campaigns/:id", summary: "Read", success: { status: 200, description: "ok" } },
      ])],
    });
    const operation = document.paths["/api/projects/{projectId}/campaigns/{id}"].get;
    expect(operation?.parameters).toEqual([
      { name: "projectId", in: "path", required: true, schema: { type: "string" } },
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ]);
  });

  it("turns a query schema into one parameter per property, required where the schema is", () => {
    const document = buildOpenApiDocument({
      info,
      groups: [group("/api/summary", [{
        method: "get",
        path: "/",
        summary: "Summarise",
        query: z.object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          kind: z.enum(["staff", "client"]).optional(),
        }),
        success: { status: 200, description: "ok" },
      }])],
    });
    expect(document.paths["/api/summary"].get?.parameters).toEqual([
      { name: "from", in: "query", required: true, schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } },
      { name: "kind", in: "query", required: false, schema: { type: "string", enum: ["staff", "client"] } },
    ]);
  });

  it("describes a body from the schema that validates it, before its transforms", () => {
    const document = buildOpenApiDocument({
      info,
      groups: [group("/api/projects", [{
        method: "post",
        path: "/",
        summary: "Create",
        body: z.object({
          name: z.string().min(1),
          email: z.string().trim().toLowerCase().pipe(z.email()),
          priority: z.enum(["HIGH", "LOW"]).optional(),
        }),
        success: { status: 201, description: "Created" },
      }])],
    });
    const body = document.paths["/api/projects"].post?.requestBody;
    expect(body?.required).toBe(true);
    expect(body?.content["application/json"].schema).toEqual({
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        email: { type: "string" },
        priority: { type: "string", enum: ["HIGH", "LOW"] },
      },
      required: ["name", "email"],
    });
  });

  it("carries a body of another content type, described as given", () => {
    const document = buildOpenApiDocument({
      info,
      groups: [group("/api/projects", [{
        method: "put",
        path: "/:id/avatar",
        summary: "Save the picture",
        bodyType: "multipart/form-data",
        body: { type: "object", properties: { image: { type: "string", format: "binary" } } },
        success: { status: 200, description: "ok" },
      }])],
    });
    const body = document.paths["/api/projects/{id}/avatar"].put?.requestBody;
    expect(Object.keys(body?.content ?? {})).toEqual(["multipart/form-data"]);
    expect(body?.content["multipart/form-data"].schema).toEqual({
      type: "object",
      properties: { image: { type: "string", format: "binary" } },
    });
  });

  it("describes the success response, its content type and its schema", () => {
    const document = buildOpenApiDocument({
      info,
      groups: [group("/api/members", [
        { method: "get", path: "/", summary: "List", success: { status: 200, description: "The members", schema: arrayOf(ref("Member")) } },
        { method: "get", path: "/:id/avatar", summary: "Read the avatar", success: { status: 200, description: "A PNG", contentType: "image/png", schema: { type: "string", format: "binary" } } },
        { method: "delete", path: "/:id", summary: "Remove", success: { status: 204, description: "Removed" } },
      ])],
    });
    const paths = document.paths;
    expect(paths["/api/members"].get?.responses["200"].content?.["application/json"].schema)
      .toEqual({ type: "array", items: { $ref: "#/components/schemas/Member" } });
    expect(paths["/api/members/{id}/avatar"].get?.responses["200"].content?.["image/png"].schema)
      .toEqual({ type: "string", format: "binary" });
    expect(paths["/api/members/{id}"].delete?.responses["204"].content).toBeUndefined();
  });

  it("gives every listed failure the shared error envelope", () => {
    const document = buildOpenApiDocument({
      info,
      groups: [group("/api/projects", [{
        method: "get", path: "/:id", summary: "Read",
        success: { status: 200, description: "ok" },
        errors: [401, 404],
      }])],
    });
    const responses = document.paths["/api/projects/{id}"].get?.responses ?? {};
    expect(Object.keys(responses)).toEqual(["200", "401", "404"]);
    expect(responses["404"].content?.["application/json"].schema)
      .toEqual({ $ref: "#/components/schemas/Error" });
    expect(responses["401"].description).toBe("Authentication required");
  });

  it("registers the error envelope and every named component under components", () => {
    const document = buildOpenApiDocument({
      info,
      groups: [],
      components: { Member: z.object({ id: z.uuid(), name: z.string() }) },
    });
    expect(document.components.schemas.Member).toMatchObject({
      type: "object",
      properties: { id: { type: "string", format: "uuid" }, name: { type: "string" } },
      required: ["id", "name"],
    });
    expect(document.components.schemas.Error).toMatchObject({ type: "object" });
  });

  it("secures every operation but the ones declared open", () => {
    const document = buildOpenApiDocument({
      info,
      groups: [group("/api/auth", [
        { method: "post", path: "/login", summary: "Log in", open: true, success: { status: 200, description: "ok" } },
        { method: "get", path: "/profile", summary: "Read the profile", success: { status: 200, description: "ok" } },
      ])],
    });
    expect(Object.keys(document.components.securitySchemes)).toEqual(["sessionCookie", "bearerAuth"]);
    expect(document.security).toEqual([{ sessionCookie: [] }, { bearerAuth: [] }]);
    expect(document.paths["/api/auth/login"].post?.security).toEqual([]);
    expect(document.paths["/api/auth/profile"].get?.security).toBeUndefined();
  });

  it("collects the tags it was given, once each, and tags every operation", () => {
    const document = buildOpenApiDocument({
      info,
      groups: [
        group("/api/projects", [{ method: "get", path: "/", summary: "List", success: { status: 200, description: "ok" } }]),
        group("/api/projects/:projectId", [{ method: "get", path: "/summary", summary: "Sum", success: { status: 200, description: "ok" } }]),
      ],
    });
    expect(document.tags).toEqual([{ name: "Projects" }]);
    expect(document.paths["/api/projects"].get?.tags).toEqual(["Projects"]);
  });

  it("refuses two operations on the same method and path", () => {
    expect(() => buildOpenApiDocument({
      info,
      groups: [group("/api/projects", [
        { method: "get", path: "/:id", summary: "Read", success: { status: 200, description: "ok" } },
        { method: "get", path: "/:id", summary: "Read again", success: { status: 200, description: "ok" } },
      ])],
    })).toThrow(/get \/api\/projects\/\{id\}/);
  });
});

describe("merging the components of several modules", () => {
  it("keeps every named schema", () => {
    const merged = mergeComponents({ Client: z.object({}) }, { Project: z.object({}) });
    expect(Object.keys(merged)).toEqual(["Client", "Project"]);
  });

  it("refuses two modules naming the same component", () => {
    expect(() => mergeComponents({ Client: z.object({}) }, { Client: z.object({}) }))
      .toThrow(/component named Client/);
  });
});

describe("an optional request body", () => {
  it("is described as optional", () => {
    const document = buildOpenApiDocument({
      info: { title: "AdPulse API", version: "0.1.0" },
      groups: [{
        mount: "/api/auth",
        tag: "Auth",
        operations: [{
          method: "post", path: "/refresh", summary: "Refresh", open: true,
          body: z.object({ refreshToken: z.string() }), bodyRequired: false,
          success: { status: 200, description: "ok" },
        }],
      }],
    });
    expect(document.paths["/api/auth/refresh"].post?.requestBody?.required).toBe(false);
  });
});

describe("operation identifiers", () => {
  const document = () => buildOpenApiDocument({
    info: { title: "AdPulse API", version: "0.1.0" },
    groups: [
      { mount: "/api/projects", tag: "Projects", operations: [
        { method: "get", path: "/", summary: "List", success: { status: 200, description: "ok" } },
        { method: "get", path: "/:id", summary: "Read", success: { status: 200, description: "ok" } },
        { method: "put", path: "/:id/avatar", summary: "Save", success: { status: 200, description: "ok" } },
      ] },
      { mount: "/api/projects/:projectId", tag: "Campaigns", operations: [
        { method: "get", path: "/campaigns/names", summary: "Name", success: { status: 200, description: "ok" } },
      ] },
    ],
  });

  it("names every operation after its method and path", () => {
    const paths = document().paths;
    expect(paths["/api/projects"].get?.operationId).toBe("getProjects");
    expect(paths["/api/projects/{id}"].get?.operationId).toBe("getProjectById");
    expect(paths["/api/projects/{id}/avatar"].put?.operationId).toBe("putProjectByIdAvatar");
    expect(paths["/api/projects/{projectId}/campaigns/names"].get?.operationId)
      .toBe("getProjectByProjectIdCampaignsNames");
  });

  it("gives no two operations the same identifier", () => {
    const ids = Object.values(document().paths)
      .flatMap((methods) => Object.values(methods).map((operation) => operation.operationId));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("tag descriptions", () => {
  it("carries the description the first group giving one supplies", () => {
    const document = buildOpenApiDocument({
      info: { title: "AdPulse API", version: "0.1.0" },
      groups: [
        { mount: "/api/campaigns", tag: "Campaigns", operations: [
          { method: "get", path: "/:id", summary: "Read", success: { status: 200, description: "ok" } },
        ] },
        { mount: "/api/summary", tag: "Campaigns", tagDescription: "Figures and the hierarchy they hang on", operations: [
          { method: "get", path: "/", summary: "Sum", success: { status: 200, description: "ok" } },
        ] },
      ],
    });
    expect(document.tags).toEqual([
      { name: "Campaigns", description: "Figures and the hierarchy they hang on" },
    ]);
  });
});

describe("two paths that would share an identifier", () => {
  it("is refused", () => {
    expect(() => buildOpenApiDocument({
      info: { title: "AdPulse API", version: "0.1.0" },
      groups: [
        { mount: "/api/ad-sets", tag: "Campaigns", operations: [
          { method: "get", path: "/ads", summary: "List", success: { status: 200, description: "ok" } },
        ] },
        { mount: "/api/ad_sets", tag: "Campaigns", operations: [
          { method: "get", path: "/ads", summary: "List again", success: { status: 200, description: "ok" } },
        ] },
      ],
    })).toThrow(/named getAdSetsAds/);
  });
});
