import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let auth: { Authorization: string };
let membershipId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  membershipId = admin.actor!.membershipId;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("GET /api/members/:id/avatar", () => {
  it("404s for a member who has no picture", async () => {
    const res = await request(app).get(`/api/members/${membershipId}/avatar`).set(auth);
    expect(res.status).toBe(404);
  });

  it("404s for a membership in another organization", async () => {
    const other = await signInAs("Other", { role: "ADMIN" });
    const res = await request(app)
      .get(`/api/members/${other.actor!.membershipId}/avatar`).set(auth);
    expect(res.status).toBe(404);
  });

  it("404s for a membership that does not exist", async () => {
    const res = await request(app).get(`/api/members/${MISSING}/avatar`).set(auth);
    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    const res = await request(app).get(`/api/members/${membershipId}/avatar`);
    expect(res.status).toBe(401);
  });

  it("serves the stored picture as an image", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const upload = await request(app).put("/api/user/avatar").set(auth)
      .field("avatarPath", JSON.stringify({ topType: "NoHair" }))
      .attach("image", png, { filename: "a.png", contentType: "image/png" });
    expect(upload.status).toBe(204);

    const res = await request(app).get(`/api/members/${membershipId}/avatar`).set(auth);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe("whose picture a member may see", () => {
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  async function withPicture(person: { auth: { Authorization: string } }) {
    const upload = await request(app).put("/api/user/avatar").set(person.auth)
      .field("avatarPath", JSON.stringify({ topType: "NoHair" }))
      .attach("image", PNG, { filename: "a.png", contentType: "image/png" });
    expect(upload.status).toBe(204);
  }

  const pictureOf = (id: string, viewer: { Authorization: string }) =>
    request(app).get(`/api/members/${id}/avatar`).set(viewer);

  async function customerOf(name: string, clientId: string) {
    const customer = await signInAs(name, { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);
    return customer;
  }

  it("serves an admin's picture to a manager and a guest", async () => {
    await withPicture({ auth });
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const guest = await signInAs("Guest", { role: "GUEST" });

    expect((await pictureOf(membershipId, manager.auth)).status).toBe(200);
    expect((await pictureOf(membershipId, guest.auth)).status).toBe(200);
  });

  it("serves the agency's pictures to a customer", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await withPicture(manager);
    const acme = await prisma.client.create({ data: { name: "Acme", orgId: manager.actor!.orgId } });
    const customer = await customerOf("Customer", acme.id);

    expect((await pictureOf(manager.actor!.membershipId, customer.auth)).status).toBe(200);
  });

  it("serves a customer the picture of a colleague on the same client only", async () => {
    const orgId = (await signInAs("Someone", { role: "MANAGER" })).actor!.orgId;
    const acme = await prisma.client.create({ data: { name: "Acme", orgId } });
    const globex = await prisma.client.create({ data: { name: "Globex", orgId } });
    const viewer = await customerOf("Viewer", acme.id);
    const colleague = await customerOf("Colleague", acme.id);
    const stranger = await customerOf("Stranger", globex.id);
    await withPicture(colleague);
    await withPicture(stranger);

    expect((await pictureOf(colleague.actor!.membershipId, viewer.auth)).status).toBe(200);
    expect((await pictureOf(stranger.actor!.membershipId, viewer.auth)).status).toBe(404);
  });

  it("serves nothing across organizations", async () => {
    await withPicture({ auth });
    const outsider = await signInAsOutsider();

    expect((await pictureOf(membershipId, outsider.auth)).status).toBe(404);
  });
});
