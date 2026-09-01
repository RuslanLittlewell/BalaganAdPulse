import { describe, expect, it } from "vitest";
import { createContainer } from "../../src/composition/create-container.js";
import { createRoutes, ROUTE_MOUNTS } from "../../src/composition/create-routes.js";

const expectedMounts = [
  "/api/auth",
  "/api",
  "/api",
  "/api",
  "/api/auth/me",
  "/api/user",
  "/api/invites",
  "/api/members",
  "/api/audit",
  "/api/projects/:projectId/campaigns",
  "/api/projects",
  "/api/clients",
  "/api/campaigns/:campaignId/properties",
  "/api/campaigns/:campaignId/records",
  "/api/campaigns",
  "/api/properties",
  "/api/records",
  "/api/tasks",
  "/api/task-images",
  "/api",
];

describe("API composition", () => {
  it("keeps every current router and middleware mounted exactly once and in order", () => {
    expect(ROUTE_MOUNTS.map(({ path }) => path)).toEqual(expectedMounts);
    expect(ROUTE_MOUNTS.map(({ id }) => id)).toHaveLength(new Set(ROUTE_MOUNTS.map(({ id }) => id)).size);
  });

  it("builds one complete router from compatibility dependencies", () => {
    const router = createRoutes(createContainer());
    expect(router.stack).toHaveLength(ROUTE_MOUNTS.length);
  });
});
