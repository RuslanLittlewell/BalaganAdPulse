import { z } from "zod";
import type { RouteDoc } from "#shared/presentation/openapi.js";
import { LATEST_NOTIFICATIONS, NOTIFICATION_KINDS } from "#modules/notifications/domain/notification.js";

const notificationSchema = z.object({
  id: z.uuid(),
  kind: z.enum(NOTIFICATION_KINDS),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
  project: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  task: z.object({
    id: z.uuid(),
    title: z.string(),
    projectId: z.uuid().nullable(),
    dueDate: z.iso.date().nullable(),
    dueTime: z.string().nullable(),
  }).nullable(),
  document: z.object({ id: z.uuid(), title: z.string() }).nullable(),
  actor: z.object({ name: z.string() }).nullable(),
});

const listSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.int(),
});

export const notificationDoc: RouteDoc = {
  tag: "Notifications",
  tagDescription:
    "Each member's own notifications: a project meeting its KPI for the month, a new project or project document, being named on a task, a change to a task one is on, a task's deadline less than a day away. They are listed newest first, read one by one or all at once, and arrive live on an event stream.",
  operations: [
    {
      method: "get",
      path: "/",
      summary: `List the caller's latest ${LATEST_NOTIFICATIONS} notifications`,
      success: { status: 200, description: "The notifications, newest first, and how many of all are unread", schema: listSchema },
      errors: [401],
    },
    {
      method: "post",
      path: "/read-all",
      summary: "Mark all of the caller's notifications read",
      success: { status: 204, description: "None is unread" },
      errors: [401],
    },
    {
      method: "post",
      path: "/:id/read",
      summary: "Mark one of the caller's notifications read",
      success: { status: 204, description: "The notification is read" },
      errors: [401, 404],
    },
    {
      method: "get",
      path: "/stream",
      summary: "Receive the caller's notifications as they are created",
      description:
        "Server-Sent Events. A `ready` event opens the stream; each new notification follows as a `notification` event whose data is the notification as the list returns it; a comment keeps the connection alive every 25 seconds.",
      success: { status: 200, description: "An event stream", contentType: "text/event-stream", schema: { type: "string" } },
      errors: [401],
    },
  ],
};
