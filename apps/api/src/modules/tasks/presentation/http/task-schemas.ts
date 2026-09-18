import { z } from "zod";
import { TASK_COLUMNS, TASK_PRIORITIES } from "../../domain/board.js";
import { TASK_REPEATS, isCalendarDay, isTimeOfDay } from "../../domain/schedule.js";

const description = z.unknown().nullable().optional();

const dueDate = z.string()
  .refine(isCalendarDay, "dueDate must be a real YYYY-MM-DD calendar day")
  .nullable()
  .optional();

const dueTime = z.string()
  .refine(isTimeOfDay, "dueTime must be a HH:MM time of day")
  .nullable()
  .optional();

const checklist = z.array(z.object({
  title: z.string().trim().min(1, "A checklist item needs a title"),
  done: z.boolean().optional(),
})).optional();

export const createTaskSchema = z.object({
  projectId: z.uuid("projectId must be a uuid").nullable().optional(),
  title: z.string().trim().min(1, "title is required"),
  description,
  column: z.enum(TASK_COLUMNS).optional(),
  priority: z.enum(TASK_PRIORITIES),
  assigneeId: z.uuid().nullable().optional(),
  campaignId: z.uuid().nullable().optional(),
  dueDate,
  dueTime,
  repeatEvery: z.enum(TASK_REPEATS).optional(),
  checklist,
});

export const updateTaskSchema = z.object({
  projectId: z.uuid().nullable().optional(),
  title: z.string().trim().min(1, "title is required").optional(),
  description,
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.uuid().nullable().optional(),
  campaignId: z.uuid().nullable().optional(),
  visibleToClient: z.boolean().optional(),
  dueDate,
  dueTime,
  repeatEvery: z.enum(TASK_REPEATS).optional(),
  checklist,
});

export const taskFilterSchema = z.object({
  projectId: z.uuid().optional(),
  campaignId: z.uuid().optional(),
  dueFrom: z.string().refine(isCalendarDay, "dueFrom must be a real YYYY-MM-DD calendar day").optional(),
  dueTo: z.string().refine(isCalendarDay, "dueTo must be a real YYYY-MM-DD calendar day").optional(),
});

export const moveTaskSchema = z.object({
  column: z.enum(TASK_COLUMNS),
  position: z.number().int().min(0, "position must be >= 0"),
});
