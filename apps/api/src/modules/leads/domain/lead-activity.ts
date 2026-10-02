import { isLeadStage, LEAD_STAGE_NAMES } from './lead.js';

export const TRACKED_FIELDS = [
  'name', 'amount', 'assignee', 'company', 'tags', 'service', 'phone',
  'telegram', 'messenger', 'email', 'website', 'source', 'campaign', 'notes',
] as const;
export type TrackedField = typeof TRACKED_FIELDS[number];

export interface FieldChange { field: TrackedField; before: string; after: string }

export type ActivityEntry =
  | { id: string; kind: 'created'; actor: { name: string } | null; at: Date }
  | { id: string; kind: 'imported'; actor: null; at: Date }
  | { id: string; kind: 'changed'; actor: { name: string } | null; at: Date; changes: FieldChange[] }
  | { id: string; kind: 'moved'; actor: { name: string } | null; at: Date; stage: { from: string | null; to: string | null } }
  | { id: string; kind: 'file-added' | 'file-removed'; actor: { name: string } | null; at: Date; file: { name: string } };

export interface LeadHistoryEvent {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  actorName: string;
  createdAt: Date;
  changes: unknown;
}

export interface ActivityNames {
  columns: ReadonlyMap<string, string>;
  campaigns: ReadonlyMap<string, string>;
}

type Snapshot = Record<string, unknown>;

const isSnapshot = (value: unknown): value is Snapshot => typeof value === 'object' && value !== null && !Array.isArray(value);

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
}

function valueOf(snapshot: Snapshot, field: TrackedField, names: ActivityNames): string {
  if (field === 'assignee') {
    const assignee = snapshot.assignee;
    return isSnapshot(assignee) ? text(assignee.name) : '';
  }
  if (field === 'campaign') {
    const id = snapshot.campaignId;
    return typeof id === 'string' ? names.campaigns.get(id) ?? '' : '';
  }
  return text(snapshot[field]);
}

function stageName(stage: unknown, names: ActivityNames): string | null {
  if (typeof stage !== 'string') return null;
  return isLeadStage(stage) ? LEAD_STAGE_NAMES[stage] : names.columns.get(stage) ?? null;
}

export function campaignIdsIn(events: readonly LeadHistoryEvent[]): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    if (!isSnapshot(event.changes)) continue;
    for (const side of [event.changes.before, event.changes.after]) {
      if (isSnapshot(side) && typeof side.campaignId === 'string') ids.add(side.campaignId);
    }
  }
  return [...ids];
}

function entryOf(event: LeadHistoryEvent, names: ActivityNames): ActivityEntry | null {
  const actor = { name: event.actorName };
  const base = { id: event.id, actor, at: event.createdAt };
  if (event.action === 'CREATE') return { ...base, kind: 'created' };
  if (event.action !== 'UPDATE' || !isSnapshot(event.changes)) return null;
  const { before, after, fileAdded, fileRemoved } = event.changes;
  if (isSnapshot(fileAdded)) return { ...base, kind: 'file-added', file: { name: text(fileAdded.name) } };
  if (isSnapshot(fileRemoved)) return { ...base, kind: 'file-removed', file: { name: text(fileRemoved.name) } };
  if (!isSnapshot(before) || !isSnapshot(after)) return null;
  if (!('name' in after) && 'stage' in after) {
    if (before.stage === after.stage) return null;
    return { ...base, kind: 'moved', stage: { from: stageName(before.stage, names), to: stageName(after.stage, names) } };
  }
  const changes = TRACKED_FIELDS
    .map((field) => ({ field, before: valueOf(before, field, names), after: valueOf(after, field, names) }))
    .filter((change) => change.before !== change.after);
  return changes.length === 0 ? null : { ...base, kind: 'changed', changes };
}

export function buildActivity(
  leadId: string,
  events: readonly LeadHistoryEvent[],
  names: ActivityNames,
  importedAt: Date | null,
): ActivityEntry[] {
  const entries = events.map((event) => entryOf(event, names)).filter((entry): entry is ActivityEntry => entry !== null);
  if (importedAt) entries.unshift({ id: `imported-${leadId}`, kind: 'imported', actor: null, at: importedAt });
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.at.getTime() - a.entry.at.getTime() || b.index - a.index)
    .map(({ entry }) => entry);
}
