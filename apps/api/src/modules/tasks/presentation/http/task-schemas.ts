import { z } from "zod";
import { TASK_COLUMNS, TASK_PRIORITIES } from "../../domain/board.js";

const description = z.unknown().nullable().optional();

export const createTaskSchema = z.object({
  projectId: z.uuid("projectId must be a uuid"),
  title: z.string().trim().min(1, "title is required"),
  description,
  column: z.enum(TASK_COLUMNS).optional(),
  priority: z.enum(TASK_PRIORITIES),
  assigneeId: z.uuid().nullable().optional(),
  campaignId: z.uuid().nullable().optional(),
});

export const updateTaskSchema = z.object({
  projectId: z.uuid().optional(),
  title: z.string().trim().min(1, "title is required").optional(),
  description,
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.uuid().nullable().optional(),
  campaignId: z.uuid().nullable().optional(),
  visibleToClient: z.boolean().optional(),
});

export const moveTaskSchema = z.object({
  column: z.enum(TASK_COLUMNS),
  position: z.number().int().min(0, "position must be >= 0"),
});
