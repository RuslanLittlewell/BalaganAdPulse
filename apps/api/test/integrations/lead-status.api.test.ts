import { afterAll, beforeEach, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
let auth: { Authorization: string };
let projectId: string;
let clientId: string;
const path = () => `/api/projects/${projectId}/integrations/meta`;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  ({ projectId, clientId } = await seedProject(admin.user.id));
  await prisma.projectIntegration.create({
    data: {
      projectId, accountId: "123", currency: "BYN", timezone: "UTC", encryptedToken: "encrypted", revision: "v1",
      status: "SUCCESS", lastSuccessAt: new Date("2026-09-13T06:00:00Z"), nextDailyAt: new Date("2026-09-14T06:00:00Z"),
      leadsStatus: "ACCESS_REQUIRED", leadsLastError: "ACCESS", leadsLastSuccessAt: new Date("2026-09-13T09:00:00Z"),
      leadsCoveredUntil: new Date("2026-09-13T09:00:00Z"), leadsLeaseOwner: "worker", leadsLeaseUntil: new Date("2026-09-13T09:03:00Z"),
    },
  });
});

afterAll(() => prisma.$disconnect());

it("exposes lead import status, last lead poll and a safe error beside the advertising status", async () => {
  const read = await request(app).get(path()).set(auth);

  expect(read.status).toBe(200);
  expect(read.body).toMatchObject({
    status: "SUCCESS",
    leads: { status: "ACCESS_REQUIRED", lastSuccessAt: "2026-09-13T09:00:00.000Z", lastError: "ACCESS" },
  });
  expect(JSON.stringify(read.body)).not.toMatch(/worker|leadsCoveredUntil|leadsLease|encrypted/);
});

it("shows no lead status to members who cannot update the project", async () => {
  const guest = await signInAs("Guest", { role: "GUEST" });
  await grantAccess(guest.membership!.id, clientId);
  const customer = await signInAs("Customer", { role: "CLIENT" });
  await grantAccess(customer.membership!.id, clientId);

  for (const member of [guest, customer]) {
    const read = await request(app).get(path()).set(member.auth);
    expect(read.status).toBe(403);
    expect(JSON.stringify(read.body)).not.toMatch(/ACCESS_REQUIRED|leads/);
  }
});
