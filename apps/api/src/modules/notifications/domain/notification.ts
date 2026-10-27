export const NOTIFICATION_KINDS = [
  "KPI_MET", "PROJECT_CREATED", "TASK_ASSIGNED", "TASK_UPDATED", "DOCUMENT_ADDED", "TASK_DUE_SOON",
  "TASK_MENTIONED",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const LATEST_NOTIFICATIONS = 50;

export interface NewNotification {
  readonly recipientId: string;
  readonly kind: NotificationKind;
  readonly projectId: string | null;
  readonly taskId: string | null;
  readonly documentId: string | null;
  readonly actorId: string | null;
}

export interface NotificationView {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly createdAt: Date;
  readonly readAt: Date | null;
  readonly project: { readonly id: string; readonly name: string } | null;
  readonly task: {
    readonly id: string;
    readonly title: string;
    readonly projectId: string | null;
    readonly dueDate: string | null;
    readonly dueTime: string | null;
    readonly timeZone: string;
  } | null;
  readonly document: { readonly id: string; readonly title: string } | null;
  readonly actor: { readonly name: string } | null;
}

export interface AddressedNotification extends NotificationView {
  readonly recipientId: string;
}

export function othersThan(memberIds: readonly string[], actorId: string | undefined): string[] {
  return [...new Set(memberIds)].filter((id) => id !== actorId);
}
