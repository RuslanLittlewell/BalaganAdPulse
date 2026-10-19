import { TASK_PRIORITIES, isCalendarDay, isTimeOfDay, type TaskPriority } from "#modules/tasks/index.js";

export const MAX_VOICE_SECONDS = 120;
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const TITLE_FALLBACK_LENGTH = 80;
export const MAX_CHECKLIST_ITEMS = 20;
export const MAX_UNKNOWN_NAMES = 10;
export const DEFAULT_DRAFT_PRIORITY: TaskPriority = "MEDIUM";

export interface CatalogProject {
  readonly id: string;
  readonly name: string;
  readonly client: string;
}

export interface CatalogMember {
  readonly id: string;
  readonly name: string;
}

export interface TaskCatalog {
  readonly projects: readonly CatalogProject[];
  readonly members: readonly CatalogMember[];
}

export interface KeyedProject extends CatalogProject {
  readonly key: string;
}

export interface KeyedMember extends CatalogMember {
  readonly key: string;
  readonly speaker: boolean;
}

export interface KeyedCatalog {
  readonly projects: readonly KeyedProject[];
  readonly members: readonly KeyedMember[];
}

export interface ReadTask {
  readonly title: string;
  readonly details: string | null;
  readonly projectKey: string | null;
  readonly participantKeys: readonly string[];
  readonly unknownNames: readonly string[];
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly priority: string;
  readonly checklist: readonly string[];
}

export interface TaskDraft {
  readonly title: string;
  readonly details: string | null;
  readonly project: { readonly id: string; readonly name: string } | null;
  readonly participants: readonly CatalogMember[];
  readonly unknownNames: readonly string[];
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly priority: TaskPriority;
  readonly checklist: readonly string[];
}

export function keyedCatalog(catalog: TaskCatalog, speakerId: string): KeyedCatalog {
  return {
    projects: catalog.projects.map((project, index) => ({ ...project, key: `P${index + 1}` })),
    members: catalog.members.map((member, index) => ({
      ...member, key: `M${index + 1}`, speaker: member.id === speakerId,
    })),
  };
}

const cleaned = (value: string | null | undefined) => value?.trim() ?? "";

const distinct = (values: readonly string[]) => [...new Set(values.map(cleaned).filter(Boolean))];

function fallbackTitle(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= TITLE_FALLBACK_LENGTH ? flat : `${flat.slice(0, TITLE_FALLBACK_LENGTH - 1).trimEnd()}…`;
}

function priorityOf(value: string): TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value) ? value as TaskPriority : DEFAULT_DRAFT_PRIORITY;
}

export function draftFrom(read: ReadTask, catalog: KeyedCatalog, text: string): TaskDraft {
  const project = catalog.projects.find((candidate) => candidate.key === cleaned(read.projectKey));
  const participants = distinct(read.participantKeys)
    .map((key) => catalog.members.find((member) => member.key === key))
    .filter((member): member is KeyedMember => member !== undefined)
    .map(({ id, name }) => ({ id, name }));
  const dueDate = isCalendarDay(cleaned(read.dueDate)) ? cleaned(read.dueDate) : null;
  const dueTime = dueDate !== null && isTimeOfDay(cleaned(read.dueTime)) ? cleaned(read.dueTime) : null;
  return {
    title: cleaned(read.title) || fallbackTitle(text),
    details: cleaned(read.details) || null,
    project: project ? { id: project.id, name: project.name } : null,
    participants,
    unknownNames: distinct(read.unknownNames).slice(0, MAX_UNKNOWN_NAMES),
    dueDate,
    dueTime,
    priority: priorityOf(cleaned(read.priority)),
    checklist: distinct(read.checklist).slice(0, MAX_CHECKLIST_ITEMS),
  };
}

export function descriptionOf(details: string | null): unknown {
  const lines = (details ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return {
    type: "doc",
    content: lines.map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
  };
}
