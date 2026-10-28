import { z } from "zod";
import { arrayOf, ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { MAX_TASK_IMAGE_BYTES } from "#modules/tasks/domain/image.js";
import { TASK_COLUMNS, TASK_PRIORITIES } from "#modules/tasks/domain/board.js";
import { TASK_REPEATS } from "#modules/tasks/domain/schedule.js";
import { addTaskCommentSchema, createTaskSchema, moveTaskSchema, updateTaskSchema } from "./task-schemas.js";

const task = z.object({
  id: z.uuid(),
  projectId: z.uuid().nullable(),
  orgId: z.uuid(),
  title: z.string(),
  description: z.unknown(),
  column: z.enum(TASK_COLUMNS),
  priority: z.enum(TASK_PRIORITIES),
  createdById: z.uuid().nullable(),
  participantIds: z.array(z.uuid()),
  visibleToClient: z.boolean(),
  personal: z.boolean(),
  position: z.int(),
  dueDate: z.iso.date().nullable(),
  dueTime: z.string().nullable(),
  endTime: z.string().nullable(),
  repeatEvery: z.enum(TASK_REPEATS),
  isCall: z.boolean(),
  skipWeekends: z.boolean(),
  timeZone: z.string(),
  checklist: z.array(z.object({
    id: z.uuid(),
    title: z.string(),
    done: z.boolean(),
    position: z.int(),
  })),
  imageIds: z.array(z.uuid()),
  archivedAt: z.iso.datetime().nullable(),
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

const taskParticipant = z.object({
  id: z.uuid(),
  name: z.string(),
  image: z.string().nullable(),
});

const taskComment = z.object({
  id: z.uuid(),
  taskId: z.uuid(),
  authorId: z.uuid().nullable(),
  authorName: z.string().nullable(),
  body: z.string(),
  mentionIds: z.array(z.uuid()),
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
});

export const taskComponents: ComponentDocs = {
  Task: task,
  TaskComment: taskComment,
  TaskParticipant: taskParticipant,
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
      description: "Naming no project makes the task the member's own note: it is never shared with a client, and is reached by its author, the member responsible for it and any admin. A customer's task with no project is personal and reached by its author alone. The description is a rich-text doc; unknown parts and links other than http, https, mailto, tel or a path are refused. A checklist named here is stored with the task, in the order it is given. The due date and times are read in timeZone, or in the agency's time zone when none is named; a task that skips weekends and is due on a Saturday or a Sunday is moved to its first occurrence on a weekday.",
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
      description: "A timeZone named here becomes the zone the task's due date and times are read in. A task that skips weekends and is left due on a Saturday or a Sunday is moved to its first occurrence on a weekday.",
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
      description: "Moves the task's due date on by its interval, to the next occurrence on a weekday when the task skips weekends, keeps its time of day, unticks its checklist, and leaves it where it sits on the board. Refused for a task that does not repeat.",
      success: { status: 200, description: "The task, due next time", schema: ref("Task") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "get",
      path: "/:id/participants",
      summary: "List the people named on a task",
      description: "The active participants, with their names and pictures, for everyone who reaches the task — the people a client's person may tag.",
      success: { status: 200, description: "The participants, in the task's order", schema: arrayOf(ref("TaskParticipant")) },
      errors: [401, 403, 404],
    },
    {
      method: "get",
      path: "/:id/comments",
      summary: "List the comments on a task",
      success: { status: 200, description: "The comments, oldest first", schema: arrayOf(ref("TaskComment")) },
      errors: [401, 403, 404],
    },
    {
      method: "post",
      path: "/:id/comments",
      summary: "Comment on a task",
      description: "The members named in mentionIds are tagged and notified. A client's person tags only the people named on the task, and a client's person is tagged only on a task shared with the client.",
      body: addTaskCommentSchema,
      success: { status: 201, description: "The comment", schema: ref("TaskComment") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "patch",
      path: "/:id/comments/:commentId",
      summary: "Edit a comment",
      description: "Only the comment's author may edit it. The body and mentionIds replace the comment's own; only members newly named in mentionIds are notified.",
      body: addTaskCommentSchema,
      success: { status: 200, description: "The edited comment, with editedAt set", schema: ref("TaskComment") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "delete",
      path: "/:id/comments/:commentId",
      summary: "Delete a comment",
      description: "Only the comment's author or an admin may delete it.",
      success: { status: 204, description: "The comment is gone" },
      errors: [401, 403, 404],
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
