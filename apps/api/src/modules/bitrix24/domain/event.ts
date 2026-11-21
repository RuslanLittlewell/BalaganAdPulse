import { EVENT_KINDS, type SyncKind } from "./records.js";

type Raw = Record<string, unknown>;

export interface WebhookEvent {
  token: string | null;
  kind: SyncKind | null;
  remoteId: string | null;
}

const objectOf = (value: unknown): Raw => (value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {});
const textOf = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text === "" || text === "0" ? null : text;
};

export function parseWebhookEvent(body: unknown): WebhookEvent {
  const raw = objectOf(body);
  const token = textOf(objectOf(raw.auth).application_token);
  const kind = EVENT_KINDS[String(raw.event ?? "").toUpperCase()] ?? null;
  const data = objectOf(raw.data);
  const fields = objectOf(data.FIELDS_AFTER ?? data.FIELDS);
  const id = textOf(fields.ID);
  if (!kind || !id) return { token, kind: null, remoteId: null };
  if (kind === "COMMENT") {
    const taskId = textOf(fields.TASK_ID);
    return taskId ? { token, kind, remoteId: `${taskId}:${id}` } : { token, kind: null, remoteId: null };
  }
  return { token, kind, remoteId: id };
}
