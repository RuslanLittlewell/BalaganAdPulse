import { format } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { getLocale } from "@/shared/config/locale.js";
import { t } from "@/shared/config/index.js";
import type { AuditEvent } from "../api/api.js";

export interface EventDescription {
  readonly subject: string;
  readonly name: string | null;
  readonly detail: string | null;
}

const TASK_COLUMNS = ["IDEA", "QUEUED", "ARCHIVED", "IN_PROGRESS", "NEEDS_FIX", "IN_REVIEW", "DONE"] as const;

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
  "lead-field": t("activity.subject.leadField"),
  "crm-company": t("activity.subject.crmCompany"),
  "crm-person": t("activity.subject.crmPerson"),
  "task-comment": t("activity.subject.taskComment"),
  "task-image": t("activity.subject.taskImage"),
  "task-document": t("activity.subject.taskDocument"),
  "lead-note": t("activity.subject.leadNote"),
  member: t("activity.subject.member"),
  invite: t("activity.subject.invite"),
};

const KPI_SUBJECTS: Record<string, string> = {
  project: t("activity.subject.projectKpi"),
  organization: t("activity.subject.organizationKpi"),
  campaign: t("activity.subject.campaignKpi"),
};

function monthOf(month: string): string {
  const [year, number] = month.split("-").map(Number) as [number, number];
  return format(new Date(year, number - 1, 1), "LLLL yyyy", { locale: getLocale() === "en" ? enUS : ru });
}

function dayOf(day: string): string {
  return format(new Date(`${day}T00:00:00`), "d MMM", { locale: getLocale() === "en" ? enUS : ru });
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

function recordName(changes: unknown): string | null {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return null;
  const record = changes as Record<string, unknown>;
  for (const side of [record.after, record.before]) {
    const name = side && typeof side === "object" ? (side as { name?: unknown }).name : null;
    if (typeof name === "string" && name !== "") return name;
  }
  return null;
}

function addedFiles(changes: unknown): string | null {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return null;
  const record = changes as { documentsAdded?: unknown; imagesAdded?: unknown };
  const parts: string[] = [];
  if (Array.isArray(record.documentsAdded) && record.documentsAdded.length > 0) {
    const names = record.documentsAdded.flatMap((document) =>
      document && typeof (document as { name?: unknown }).name === "string" ? [quoted((document as { name: string }).name)] : []);
    const label = t(names.length === 1 ? "activity.detail.documentAdded" : "activity.detail.documentsAdded");
    parts.push(`${label} ${names.join(", ")}`);
  }
  if (Array.isArray(record.imagesAdded) && record.imagesAdded.length > 0) {
    parts.push(record.imagesAdded.length === 1
      ? t("activity.detail.imageAdded")
      : `${t("activity.detail.imagesAdded")} (${record.imagesAdded.length})`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

type Reading = (match: RegExpExecArray, event: AuditEvent) => EventDescription;

const subjectOf = (event: AuditEvent) => SUBJECTS[event.entityType] ?? event.entityType;

const READINGS: readonly [RegExp, Reading][] = [
  [/^(?:Created|Updated|Deleted) (?:client|project|task) “(.*)”$/,
    ([, name], event) => ({
      subject: subjectOf(event), name: name!, detail: event.entityType === "task" ? addedFiles(event.changes) : null,
    })],
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
  [/^Changed the summary of project “(.*?)”(?: for \S+ account \S+)?$/,
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
  [/^Reset the second factor of (.*)$/,
    ([, name]) => ({ subject: t("activity.subject.member"), name: name!, detail: t("activity.detail.twoFactorReset") })],
  [/^Removed (.*) from the organization$/,
    ([, name]) => ({ subject: t("activity.subject.member"), name: name!, detail: t("activity.detail.memberRemoved") })],
  [/^Revoked the invitation for (.*)$/,
    ([, email]) => ({ subject: t("activity.subject.invite"), name: email!, detail: t("activity.detail.inviteRevoked") })],
  [/^Revoked an invitation$/,
    () => ({ subject: t("activity.subject.invite"), name: null, detail: t("activity.detail.inviteRevoked") })],
  [/^(?:Added a comment to|Edited a comment on|Deleted a comment on) task “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.taskComment"), name: name!, detail: null })],
  [/^Removed an image from task “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.taskImage"), name: name!, detail: null })],
  [/^Removed document “(.*)” from task “(.*)”$/,
    ([, document, task]) => ({
      subject: t("activity.subject.taskDocument"), name: task!, detail: `${t("activity.detail.documentRemoved")} ${quoted(document!)}`,
    })],
  [/^(?:Added a note to|Edited a note on|Deleted a note on) lead “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.leadNote"), name: name!, detail: null })],
  [/^Created a share link for project “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.project"), name: name!, detail: t("activity.detail.shareLinkCreated") })],
  [/^Replaced the share link of project “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.project"), name: name!, detail: t("activity.detail.shareLinkReplaced") })],
  [/^Switched off the share link of project “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.project"), name: name!, detail: t("activity.detail.shareLinkOff") })],
  [/^Created a website key for project “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.project"), name: name!, detail: t("activity.detail.keyCreated") })],
  [/^Replaced the website key of project “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.project"), name: name!, detail: t("activity.detail.keyReplaced") })],
  [/^Removed the website key of project “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.project"), name: name!, detail: t("activity.detail.keyRemoved") })],
  [/^Changed the sites allowed to send leads to project “(.*)”$/,
    ([, name]) => ({ subject: t("activity.subject.project"), name: name!, detail: t("activity.detail.keySites") })],
  [/^Edited the (\d{4}-\d{2}) report$/,
    ([, month]) => ({ subject: t("activity.subject.report"), name: monthOf(month!), detail: t("activity.detail.reportEdited") })],
  [/^Refreshed the (\d{4}-\d{2}) report$/,
    ([, month]) => ({ subject: t("activity.subject.report"), name: monthOf(month!), detail: t("activity.detail.reportRefreshed") })],
  [/^Entered past months for the (\d{4}-\d{2}) report$/,
    ([, month]) => ({ subject: t("activity.subject.report"), name: monthOf(month!), detail: t("activity.detail.reportPastMonths") })],
  [/^Connected Google Ads account$/,
    () => ({ subject: t("activity.subject.googleAdsAccount"), name: null, detail: t("activity.detail.connected") })],
  [/^Renewed Google Ads sign-in$/,
    () => ({ subject: t("activity.subject.googleAdsAccount"), name: null, detail: t("activity.detail.signInRenewed") })],
  [/^Disconnected Google Ads account$/,
    () => ({ subject: t("activity.subject.googleAdsAccount"), name: null, detail: t("activity.detail.disconnected") })],
  [/^Replaced Meta advertising account credentials$/,
    () => ({ subject: t("activity.subject.metaAccount"), name: null, detail: t("activity.detail.credentialsReplaced") })],
  [/^Connected Search Console site (.+)$/,
    ([, site]) => ({ subject: t("activity.subject.searchConsoleSite"), name: site!, detail: t("activity.detail.connected") })],
  [/^Renewed Search Console sign-in for (.+)$/,
    ([, site]) => ({ subject: t("activity.subject.searchConsoleSite"), name: site!, detail: t("activity.detail.signInRenewed") })],
  [/^Disconnected Search Console site (.+)$/,
    ([, site]) => ({ subject: t("activity.subject.searchConsoleSite"), name: site!, detail: t("activity.detail.disconnected") })],
  [/^Linked Google Analytics property (.+?) to (.+)$/,
    ([, property, site]) => ({
      subject: t("activity.subject.analytics"), name: property!, detail: `${t("activity.detail.analyticsLinked")} ${quoted(site!)}`,
    })],
  [/^Unlinked Google Analytics from (.+)$/,
    ([, site]) => ({
      subject: t("activity.subject.analytics"), name: null, detail: `${t("activity.detail.analyticsUnlinked")} ${quoted(site!)}`,
    })],
  [/^(?:CREATE|UPDATE|DELETE) lead$/,
    (_match, event) => ({
      subject: t("activity.subject.lead"), name: recordName(event.changes), detail: leadDetail(event.changes),
    })],
  [/^(?:CREATE|UPDATE|DELETE) lead column$/,
    (_match, event) => ({ subject: t("activity.subject.leadColumn"), name: recordName(event.changes), detail: null })],
  [/^(?:CREATE|UPDATE|DELETE) lead field$/,
    (_match, event) => ({ subject: t("activity.subject.leadField"), name: recordName(event.changes), detail: null })],
  [/^(?:CREATE|UPDATE|DELETE) company$/,
    (_match, event) => ({ subject: t("activity.subject.crmCompany"), name: recordName(event.changes), detail: null })],
  [/^(?:CREATE|UPDATE|DELETE) person$/,
    (_match, event) => ({ subject: t("activity.subject.crmPerson"), name: recordName(event.changes), detail: null })],
];

export function describeAuditEvent(event: AuditEvent): EventDescription | null {
  for (const [pattern, reading] of READINGS) {
    const match = pattern.exec(event.summary);
    if (match) return reading(match, event);
  }
  return null;
}
