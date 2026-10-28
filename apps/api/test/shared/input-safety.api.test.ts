import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { updateDocumentSchema } from "../../src/modules/project-documents/presentation/http/project-document-schemas.js";
import { editSchema } from "../../src/modules/reports/presentation/http/report-schemas.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let projectId: string;
let clientId: string;

const doc = (...content: unknown[]) => ({ type: "doc", content });
const linked = (href: string) =>
  doc({ type: "paragraph", content: [{ type: "text", text: "сайт", marks: [{ type: "link", attrs: { href } }] }] });

const createTask = (body: Record<string, unknown>) =>
  request(app).post("/api/tasks").set(admin.auth).send({ projectId, title: "Макет", priority: "MEDIUM", ...body });

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Admin", { role: "ADMIN" });
  ({ projectId, clientId } = await seedProject(admin.user.id, "Acme"));
});
afterAll(() => prisma.$disconnect());

describe("a task's description", () => {
  it("is stored as the editor wrote it", async () => {
    const description = doc(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "План" }] },
      { type: "paragraph", content: [{ type: "text", text: "сайт", marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://acme.by", target: "_blank" } }] }] },
    );

    const res = await createTask({ description });

    expect(res.status).toBe(201);
    expect(res.body.description).toEqual(description);
  });

  it.each(["javascript:alert(1)", "java\tscript:alert(1)", "data:text/html,<script>alert(1)</script>"])(
    "refuses a link to %j and stores nothing", async (href) => {
      const res = await createTask({ description: linked(href) });

      expect(res.status).toBe(400);
      expect(await prisma.task.count()).toBe(0);
    },
  );

  it("refuses a part the editor does not make, and keeps the description it had", async () => {
    const task = (await createTask({ description: linked("https://acme.by") })).body;

    const res = await request(app).patch(`/api/tasks/${task.id}`).set(admin.auth)
      .send({ description: doc({ type: "iframe", attrs: { src: "https://evil.test" } }) });

    expect(res.status).toBe(400);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).description).toEqual(linked("https://acme.by"));
  });
});

describe("a project document and a monthly report", () => {
  it("refuse a link that runs script", () => {
    expect(updateDocumentSchema.safeParse({ content: linked("javascript:alert(1)") }).success).toBe(false);
    expect(editSchema.safeParse({ conclusions: linked("https://acme.by") }).success).toBe(false);
    expect(editSchema.safeParse({ plan: doc({ type: "iframe" }) }).success).toBe(false);
  });

  it("take what their editors make", () => {
    expect(updateDocumentSchema.safeParse({ content: linked("https://acme.by") }).success).toBe(true);
    expect(editSchema.safeParse({ conclusions: doc({ type: "paragraph", content: [{ type: "text", text: "Итог" }] }), plan: null }).success).toBe(true);
  });
});

describe("text inputs", () => {
  it("refuse a task title over 500 characters", async () => {
    expect((await createTask({ title: "a".repeat(501) })).status).toBe(400);
    expect((await createTask({ title: "a".repeat(500) })).status).toBe(201);
  });

  it("refuse a checklist item over 500 characters", async () => {
    expect((await createTask({ checklist: [{ title: "a".repeat(501) }] })).status).toBe(400);
  });

  it("refuse a client's name or detail over 300 characters, and a phone over 100", async () => {
    const post = (body: Record<string, unknown>) => request(app).post("/api/clients").set(admin.auth).send({ name: "Acme", ...body });
    expect((await post({ name: "a".repeat(301) })).status).toBe(400);
    expect((await post({ organization: "a".repeat(301) })).status).toBe(400);
    expect((await post({ phone: "1".repeat(101) })).status).toBe(400);
    expect((await post({ organization: "a".repeat(300), phone: "1".repeat(100) })).status).toBe(201);
  });

  it("refuse a project's name over 200 characters", async () => {
    const res = await request(app).post("/api/projects").set(admin.auth).send({ clientId, name: "a".repeat(201) });
    expect(res.status).toBe(400);
  });

  it("refuse a person's name over 200 characters", async () => {
    const res = await request(app).patch("/api/user/profile").set(admin.auth).send({ name: "a".repeat(201) });
    expect(res.status).toBe(400);
  });
});

describe("every response", () => {
  it.each([
    ["a health check", () => request(app).get("/healthz")],
    ["an API answer", () => request(app).get("/api/clients").set(admin.auth)],
    ["a refusal", () => request(app).get("/api/clients")],
  ])("carries the protective headers on %s", async (_label, send) => {
    const res = await send();

    expect(res.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "content-security-policy": "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    });
  });
});
