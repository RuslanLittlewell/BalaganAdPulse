import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { config } from "../../src/shared/infrastructure/config.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const APP_ORIGIN = new URL(config.appUrl!).origin;
let token: string;

beforeEach(async () => {
  await resetDb();
  token = (await signInAs("Admin")).auth.Authorization.slice("Bearer ".length);
});
afterAll(() => prisma.$disconnect());

const cookie = () => ({ Cookie: `adpulse_access=${token}` });
const createClient = (headers: Record<string, string>) =>
  request(app).post("/api/clients").set(headers).send({ name: "Ромашка" });

describe("cookie-authenticated writes", () => {
  it("are refused from another origin and change nothing", async () => {
    const res = await createClient({ ...cookie(), Origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("Cross-origin request refused");
    expect(await prisma.client.count({ where: { name: "Ромашка" } })).toBe(0);
  });

  it("are refused from a sibling site that sends no Origin", async () => {
    expect((await createClient({ ...cookie(), "Sec-Fetch-Site": "same-site" })).status).toBe(403);
  });

  it("pass from the app's own origin", async () => {
    expect((await createClient({ ...cookie(), Origin: APP_ORIGIN })).status).toBe(201);
  });

  it("pass without browser headers", async () => {
    expect((await createClient(cookie())).status).toBe(201);
  });

  it("are not checked when the token is in the header", async () => {
    expect((await createClient({ Authorization: `Bearer ${token}`, Origin: "https://evil.example" })).status).toBe(201);
  });
});

describe("cookie-authenticated reads", () => {
  it("are not checked", async () => {
    expect((await request(app).get("/api/clients").set({ ...cookie(), Origin: "https://evil.example" })).status).toBe(200);
  });
});
