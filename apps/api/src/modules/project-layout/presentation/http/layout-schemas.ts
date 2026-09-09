import { z } from "zod";

export const layoutSchema = z.object({
  pinned: z.array(z.uuid("pinned must hold project ids")).default([]),
  items: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("project"), projectId: z.uuid("projectId must be a uuid") }),
    z.object({
      type: z.literal("group"),
      groupId: z.uuid("groupId must be a uuid"),
      projectIds: z.array(z.uuid("projectIds must hold project ids")).default([]),
    }),
  ])).default([]),
});

export const groupSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(60, "name must be 60 characters or fewer"),
});
