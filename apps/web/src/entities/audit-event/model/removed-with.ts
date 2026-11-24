import { getIntlLocale } from "@/shared/config/locale.js";
import { t, type MessageKey } from "@/shared/config/index.js";
import type { AuditEvent } from "../api/api.js";

const KINDS = [
  "projects", "companies", "persons", "campaigns", "tasks", "leads", "reports", "documents", "notes", "comments", "files",
] as const;

const HEADINGS: Record<string, MessageKey> = {
  client: "activity.removedWith.client",
  project: "activity.removedWith.project",
  lead: "activity.removedWith.lead",
  task: "activity.removedWith.task",
};

const countsOf = (changes: unknown): Record<string, number> | null => {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return null;
  const counts = (changes as { removedWith?: unknown }).removedWith;
  return counts && typeof counts === "object" && !Array.isArray(counts) ? counts as Record<string, number> : null;
};

function counted(kind: (typeof KINDS)[number], count: number, rules: Intl.PluralRules): string {
  const category = rules.select(count);
  const form = category === "one" ? "one" : category === "few" ? "few" : "many";
  return `${count} ${t(`activity.removedWith.${kind}.${form}` as MessageKey)}`;
}

export function describeRemovedWith(event: Pick<AuditEvent, "entityType" | "changes">): string | null {
  const heading = HEADINGS[event.entityType];
  const counts = countsOf(event.changes);
  if (!heading || !counts) return null;
  const rules = new Intl.PluralRules(getIntlLocale());
  const parts = KINDS.flatMap((kind) => {
    const count = counts[kind];
    return typeof count === "number" && count > 0 ? [counted(kind, count, rules)] : [];
  });
  return parts.length > 0 ? `${t(heading)}: ${parts.join(", ")}` : null;
}
