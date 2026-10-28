import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { t } from "@/shared/config/index.js";
import type { AuditEvent } from "../api/api.js";

export interface EventDescription {
  readonly subject: string;
  readonly name: string | null;
  readonly detail: string | null;
}

const TASK_COLUMNS = ["IDEA", "ARCHIVED", "IN_PROGRESS", "NEEDS_FIX", "IN_REVIEW", "DONE"] as const;

type TaskColumn = (typeof TASK_COLUMNS)[number];

const isTaskColumn = (value: string): value is TaskColumn => (TASK_COLUMNS as readonly string[]).includes(value);

const columnLabel = (value: string) => isTaskColumn(value) ? t(`tasks.column.${value}`) : value;

const SUBJECTS: Record<string, string> = {
  task: t("activity.subject.task"),
  project: t("activity.subject.project"),
  client: t("activity.subject.client"),
  "project-document": t("activity.subject.document"),
  report: t("activity.subject.report"),
  lead: t("activity.subject.lead"),
  "lead-column": t("activity.subject.leadColumn"),
};

const KPI_SUBJECTS: Record<string, string> = {
  project: t("activity.subject.projectKpi"),
  organization: t("activity.subject.organizationKpi"),
  campaign: t("activity.subject.campaignKpi"),
};

function monthOf(month: string): string {
  const [year, number] = month.split("-").map(Number) as [number, number];
  return format(new Date(year, number - 1, 1), "LLLL yyyy", { locale: ru });
}

function dayOf(day: string): string {
  return format(new Date(`${day}T00:00:00`), "d MMM", { locale: ru });
}

const quoted = (name: string) => `«${name}»`;

function leadDetail(changes: unknown): string | null {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return null;
  const record = changes as Record<string, unknown>;
  const fileName = (value: unknown) =>
    value && typeof value === "object" && typeof (value as { name?: unknown }).name === "string"
      ? (value as { name: string }).name
      : null;
  const added = fileName(record.fileAdded);
  if (added) return `${t("activity.detail.fileAdded")} ${quoted(added)}`;
  const removed = fileName(record.fileRemoved);
  if (removed) return `${t("activity.detail.fileRemoved")} ${quoted(removed)}`;
  return null;
}

type Reading = (match: RegExpExecArray, event: AuditEvent) => EventDescription;

const subjectOf = (event: AuditEvent) => SUBJECTS[event.entityType] ?? event.entityType;

const READINGS: readonly [RegExp, Reading][] = [
  [/^(?:Created|Updated|Deleted) (?:client|project|task) “(.*)”$/,
    ([, name], event) => ({ subject: subjectOf(event), name: name!, detail: null })],
  [/^Created cabinet access for client “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.client"), name: name!, detail: t("activity.detail.cabinetCreated") })],
  [/^Issued a new cabinet password for client “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.client"), name: name!, detail: t("activity.detail.cabinetPassword") })],
  [/^Updated picture for (?:client|project) “(.*)”$/,
    ([, name], event) => ({ subject: subjectOf(event), name: name!, detail: t("activity.detail.picture") })],
  [/^Moved task “(.*)” from (\w+) to (\w+)$/,
    ([, name, from, to]) => ({
      subject: t("activity.subject.task"), name: name!, detail: `${columnLabel(from!)} → ${columnLabel(to!)}`,
    })],
  [/^Completed task “(.*)” of \S+, due next on (\d{4}-\d{2}-\d{2})$/,
    ([, name, next]) => ({
      subject: t("activity.subject.task"),
      name: name!,
      detail: `${t("activity.detail.completed")}, ${t("activity.detail.nextDue")} ${dayOf(next!)}`,
    })],
  [/^Changed the summary of project “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.project"), name: name!, detail: t("activity.detail.tiles") })],
  [/^(?:Created|Deleted) document “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.document"), name: name!, detail: null })],
  [/^Renamed document “(.*)” to “(.*)”$/,
    ([, before, after]) => ({
      subject: t("activity.subject.document"), name: after!, detail: `${t("activity.detail.was")} ${quoted(before!)}`,
    })],
  [/^(?:Generated|Deleted) the (\d{4}-\d{2}) report$/,
    ([, month]) => ({ subject: t("activity.subject.report"), name: monthOf(month!), detail: null })],
  [/^Published the (\d{4}-\d{2}) report$/,
    ([, month]) => ({ subject: t("activity.subject.report"), name: monthOf(month!), detail: t("activity.detail.published") })],
  [/^Returned the (\d{4}-\d{2}) report to draft$/,
    ([, month]) => ({ subject: t("activity.subject.report"), name: monthOf(month!), detail: t("activity.detail.toDraft") })],
  [/^Set the cover of the (\d{4}-\d{2}) report$/,
    ([, month]) => ({ subject: t("activity.subject.report"), name: monthOf(month!), detail: t("activity.detail.coverSet") })],
  [/^Removed the cover of the (\d{4}-\d{2}) report$/,
    ([, month]) => ({ subject: t("activity.subject.report"), name: monthOf(month!), detail: t("activity.detail.coverRemoved") })],
  [/^(Set|Cleared) (project|organization|campaign) KPIs?$/,
    ([, verb, owner]) => ({
      subject: KPI_SUBJECTS[owner!]!, name: null, detail: verb === "Cleared" ? t("activity.detail.cleared") : null,
    })],
  [/^(Connected|Disconnected) Meta advertising account$/,
    ([, verb]) => ({
      subject: t("activity.subject.metaAccount"),
      name: null,
      detail: verb === "Connected" ? t("activity.detail.connected") : t("activity.detail.disconnected"),
    })],
  [/^(?:CREATE|UPDATE|DELETE) lead$/,
    (_match, event) => ({ subject: t("activity.subject.lead"), name: null, detail: leadDetail(event.changes) })],
  [/^(?:CREATE|UPDATE|DELETE) lead column$/,
    () => ({ subject: t("activity.subject.leadColumn"), name: null, detail: null })],
];

export function describeAuditEvent(event: AuditEvent): EventDescription | null {
  for (const [pattern, reading] of READINGS) {
    const match = pattern.exec(event.summary);
    if (match) return reading(match, event);
  }
  return null;
}
