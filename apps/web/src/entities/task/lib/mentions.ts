import type { Task } from "../api/api.js";

export interface Taggable {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly status: string;
}

export interface MentionQuery {
  readonly start: number;
  readonly text: string;
}

export interface MentionedMember {
  readonly id: string;
  readonly name: string;
}

export interface BodySegment {
  readonly text: string;
  readonly tagged: boolean;
}

const TRIGGER = /(^|\s)@([^\s@]*)$/;

export function mentionQueryAt(text: string, caret: number): MentionQuery | null {
  const match = TRIGGER.exec(text.slice(0, caret));
  if (!match) return null;
  const typed = match[2];
  return { start: caret - typed.length - 1, text: typed };
}

export function taggableMembers<TMember extends Taggable>(
  task: Pick<Task, "participantIds" | "visibleToClient">,
  members: readonly TMember[],
  ownId: string | undefined,
): TMember[] {
  const named = new Set<string>(task.participantIds);
  return members.filter((member) =>
    member.id !== ownId
    && member.status === "ACTIVE"
    && (member.role !== "CLIENT" || (task.visibleToClient && named.has(member.id))));
}

export function matchingMembers<TMember extends { readonly name: string }>(
  members: readonly TMember[],
  typed: string,
): TMember[] {
  const wanted = typed.trim().toLowerCase();
  return members
    .filter((member) => member.name.toLowerCase().includes(wanted))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function insertMention(
  text: string,
  query: MentionQuery,
  caret: number,
  name: string,
): { text: string; caret: number } {
  const tag = `@${name} `;
  return { text: text.slice(0, query.start) + tag + text.slice(caret), caret: query.start + tag.length };
}

export function tagsStillIn(text: string, chosen: readonly MentionedMember[]): string[] {
  return [...new Set(chosen.filter((member) => text.includes(`@${member.name}`)).map((member) => member.id))];
}

export function bodySegments(body: string, tagged: readonly string[]): BodySegment[] {
  const names = [...tagged].sort((a, b) => b.length - a.length).map((name) => `@${name}`);
  if (names.length === 0) return [{ text: body, tagged: false }];
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");
  return body.split(pattern).filter((part) => part !== "")
    .map((part) => ({ text: part, tagged: names.includes(part) }));
}
