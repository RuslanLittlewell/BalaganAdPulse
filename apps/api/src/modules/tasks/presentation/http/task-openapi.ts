import { z } from "zod";
import { arrayOf, ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { MAX_TASK_IMAGE_BYTES } from "../../domain/image.js";
import { TASK_COLUMNS, TASK_PRIORITIES } from "../../domain/board.js";
import { TASK_REPEATS } from "../../domain/schedule.js";
import { createTaskSchema, moveTaskSchema, updateTaskSchema } from "./task-schemas.js";

const task = z.object({
  id: z.uuid(),
  projectId: z.uuid().nullable(),
  orgId: z.uuid(),
  title: z.string(),
  description: z.unknown(),
  column: z.enum(TASK_COLUMNS),
  priority: z.enum(TASK_PRIORITIES),
  assigneeId: z.uuid().nullable(),
  createdById: z.uuid().nullable(),
  visibleToClient: z.boolean(),
  position: z.int(),
  dueDate: z.iso.date().nullable(),
  dueTime: z.string().nullable(),
  repeatEvery: z.enum(TASK_REPEATS),
  checklist: z.array(z.object({
    id: z.uuid(),
    title: z.string(),
    done: z.boolean(),
    position: z.int(),
  })),
  imageIds: z.array(z.uuid()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const taskImage = z.object({
  id: z.uuid(),
  taskId: z.uuid().nullable(),
  uploaderId: z.uuid(),
  storageKey: z.string(),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  bytes: z.int(),
  createdAt: z.iso.datetime(),
});

export const taskComponents: ComponentDocs = {
  Task: task,
  TaskImage: taskImage,
};

export const taskDoc: RouteDoc = {
  tag: "Tasks",
  tagDescription: "The board: tasks, where they sit, and the images their descriptions carry",
  operations: [
    {
      method: "get",
      path: "/",
      summary: "List the tasks on the board",
      description: "Narrowed to the projects this actor reaches, and further by project or a range of due days when named.",
      query: z.object({
        projectId: z.uuid().optional(),
        dueFrom: z.iso.date().optional(),
        dueTo: z.iso.date().optional(),
      }),
      success: { status: 200, description: "The tasks, in column order", schema: arrayOf(ref("Task")) },
      errors: [401, 403],
    },
    {
      method: "post",
      path: "/",
      summary: "Create a task",
      description: "Naming no project makes the task the member's own note: it is never shared with a client, and is reached by its author, the member responsible for it and any admin. A checklist named here is stored with the task, in the order it is given.",
      body: createTaskSchema,
      success: { status: 201, description: "The task", schema: ref("Task") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "get",
      path: "/:id",
      summary: "Read a task",
      success: { status: 200, description: "The task", schema: ref("Task") },
      errors: [401, 403, 404],
    },
    {
      method: "patch",
      path: "/:id",
      summary: "Change a task",
      body: updateTaskSchema,
      success: { status: 200, description: "The task as it now stands", schema: ref("Task") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "delete",
      path: "/:id",
      summary: "Delete a task",
      success: { status: 204, description: "The task and its images are gone" },
      errors: [401, 403, 404],
    },
    {
      method: "post",
      path: "/:id/move",
      summary: "Move a task to a column and a position",
      body: moveTaskSchema,
      success: { status: 200, description: "The task where it now sits", schema: ref("Task") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "post",
      path: "/:id/complete",
      summary: "Complete a repeating task into its next occurrence",
      description: "Moves the task's due date on by its interval, keeps its time of day, unticks its checklist, and leaves it where it sits on the board. Refused for a task that does not repeat.",
      success: { status: 200, description: "The task, due next time", schema: ref("Task") },
      errors: [400, 401, 403, 404],
    },
  ],
};

export const taskImageDoc: RouteDoc = {
  tag: "Tasks",
  operations: [
    {
      method: "post",
      path: "/",
      summary: "Upload an image for a task description",
      description: `PNG, JPEG, WebP or GIF, up to ${MAX_TASK_IMAGE_BYTES / (1024 * 1024)} MB. The image is claimed by the task that first references it.`,
      bodyType: "multipart/form-data",
      body: {
        type: "object",
        properties: { image: { type: "string", format: "binary" } },
        required: ["image"],
      },
      success: { status: 201, description: "The stored image", schema: ref("TaskImage") },
      errors: [400, 401, 403, 413],
    },
    {
      method: "get",
      path: "/:id",
      summary: "Read an image",
      success: {
        status: 200,
        description: "The image, in the type it was uploaded as",
        contentType: "image/*",
        schema: { type: "string", format: "binary" },
      },
      errors: [401, 403, 404],
    },
    {
      method: "delete",
      path: "/:id",
      summary: "Delete an image",
      success: { status: 204, description: "The image is gone, and any description that showed it no longer does" },
      errors: [401, 403, 404],
    },
  ],
};
