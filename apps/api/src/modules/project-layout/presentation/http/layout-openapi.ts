import { z } from "zod";
import type { RouteDoc } from "#shared/presentation/openapi.js";

const group = z.object({ id: z.uuid(), name: z.string(), position: z.int() });

const layout = z.object({
  pinned: z.array(z.uuid()),
  items: z.array(z.union([
    z.object({ type: z.literal("project"), projectId: z.uuid() }),
    z.object({
      type: z.literal("group"),
      groupId: z.uuid(),
      name: z.string(),
      projectIds: z.array(z.uuid()),
    }),
  ])),
});

const arrangement = z.object({
  pinned: z.array(z.uuid()),
  items: z.array(z.union([
    z.object({ type: z.literal("project"), projectId: z.uuid() }),
    z.object({ type: z.literal("group"), groupId: z.uuid(), projectIds: z.array(z.uuid()) }),
  ])),
});

export const projectLayoutDoc: RouteDoc = {
  tag: "Project layout",
  tagDescription:
    "Each member arranges their own project list: the order of its items, the projects pinned above it and the groups projects are collected into. One member's arrangement is invisible to every other.",
  operations: [
    {
      method: "get",
      path: "/",
      summary: "Read the caller's own arrangement, with unplaced projects appended",
      success: { status: 200, description: "The caller's project list", schema: layout },
      errors: [401],
    },
    {
      method: "put",
      path: "/",
      summary: "Replace the caller's own arrangement",
      body: arrangement,
      success: { status: 200, description: "The stored arrangement", schema: layout },
      errors: [400, 401, 404],
    },
  ],
};

export const projectGroupDoc: RouteDoc = {
  tag: "Project groups",
  tagDescription: "Named groups collecting projects inside one member's own list.",
  operations: [
    {
      method: "post",
      path: "/",
      summary: "Create an empty group at the end of the caller's list",
      body: z.object({ name: z.string().min(1).max(60) }),
      success: { status: 201, description: "The created group", schema: group },
      errors: [400, 401],
    },
    {
      method: "delete",
      path: "/:id",
      summary: "Delete one of the caller's groups, which must hold no project",
      success: { status: 204, description: "Deleted" },
      errors: [401, 404, 409],
    },
  ],
};
