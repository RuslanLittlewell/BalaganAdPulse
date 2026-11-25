import { createHash } from 'node:crypto';
import { AppError } from '#shared/domain/index.js';
import { LEAD_STAGES, isLeadStage, type LeadAnswer, type LeadStage } from './lead.js';
import { phoneDigitsOf } from './crm-record.js';
import { sameCampaignName, type UtmTags } from './website-intake.js';

export const IMPORT_ROW_LIMIT = 5000;
export const IMPORT_BYTES_LIMIT = 10 * 1024 * 1024;
const ANSWER_LIMIT = 50;
const EARLIEST_SUBMISSION = Date.UTC(2000, 0, 1);
const DAY = 24 * 60 * 60 * 1000;

export type ImportRefusal = 'NOT_A_SHEET' | 'CLOSED' | 'UNREACHABLE' | 'EMPTY' | 'TOO_MANY_ROWS' | 'TOO_LARGE';

export function importRefused(code: ImportRefusal, message: string): AppError {
  return new AppError('validation', message, [{ code }]);
}

export interface ImportTable {
  columns: string[];
  rows: string[][];
}

export interface ImportRow extends UtmTags {
  name: string | null;
  phone: string | null;
  email: string | null;
  submittedAt: string | null;
  campaign: string | null;
  status: string | null;
  pageUrl: string | null;
  referrer: string | null;
  answers: LeadAnswer[];
}

const SEPARATORS = [',', ';', '\t'];

function separatorOf(text: string): string {
  const counts = new Map(SEPARATORS.map((separator) => [separator, 0]));
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  return [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best), [',', 0])[0];
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const separator = separatorOf(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char !== '"') value += char;
      else if (text[index + 1] === '"') { value += '"'; index++; }
      else quoted = false;
    } else if (char === '"' && value === '') quoted = true;
    else if (char === separator) { row.push(value); value = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  if (value !== '' || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export function tableOf(text: string): ImportTable {
  const [header = [], ...body] = parseCsv(text);
  const columns = header.map((name) => name.trim());
  const rows = body
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => columns.map((_, index) => (row[index] ?? '').trim()));
  if (columns.every((name) => name === '') || rows.length === 0) throw importRefused('EMPTY', 'The table has no rows');
  if (rows.length > IMPORT_ROW_LIMIT) throw importRefused('TOO_MANY_ROWS', `A table holds at most ${IMPORT_ROW_LIMIT} rows`);
  return { columns, rows };
}

const SHEET_PATH = /^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{10,})(?:\/|$)/;

export function sheetExportUrl(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.hostname !== 'docs.google.com') return null;
  const id = SHEET_PATH.exec(url.pathname)?.[1];
  if (!id) return null;
  const gid = url.searchParams.get('gid') ?? new URLSearchParams(url.hash.slice(1)).get('gid');
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid && /^\d+$/.test(gid) ? `&gid=${gid}` : ''}`;
}

const DOTTED = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const ZONED = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

function dottedTime(match: RegExpExecArray): number {
  const [day, month, year, hours, minutes, seconds] = match.slice(1).map((part) => Number(part ?? 0)) as [number, number, number, number, number, number];
  const time = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  const date = new Date(time);
  return date.getUTCDate() === day && date.getUTCMonth() === month - 1 && hours < 24 ? time : Number.NaN;
}

export function submittedAtOf(text: string | null, now: Date): Date | null {
  const value = text?.trim();
  if (!value) return null;
  const dotted = DOTTED.exec(value);
  let time = Number.NaN;
  if (dotted) time = dottedTime(dotted);
  else if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const iso = value.replace(' ', 'T');
    time = Date.parse(iso.includes('T') && !ZONED.test(iso) ? `${iso}Z` : iso);
  }
  if (!Number.isFinite(time) || time < EARLIEST_SUBMISSION || time > now.getTime() + DAY) return null;
  return new Date(time);
}

function cut(value: string | null | undefined, limit: number): string | null {
  const text = value?.trim() ?? '';
  return text === '' ? null : text.slice(0, limit);
}

export function normalizedRow(row: ImportRow): ImportRow {
  return {
    name: cut(row.name, 200),
    phone: cut(row.phone, 50),
    email: cut(row.email, 254),
    submittedAt: cut(row.submittedAt, 100),
    campaign: cut(row.campaign, 300),
    status: cut(row.status, 200),
    utmSource: cut(row.utmSource, 300),
    utmMedium: cut(row.utmMedium, 300),
    utmCampaign: cut(row.utmCampaign, 300),
    utmContent: cut(row.utmContent, 300),
    utmTerm: cut(row.utmTerm, 300),
    pageUrl: cut(row.pageUrl, 2048),
    referrer: cut(row.referrer, 2048),
    answers: row.answers
      .map((answer) => ({
        question: cut(answer.question, 200) ?? '',
        values: answer.values.map((entry) => cut(entry, 2000)).filter((entry): entry is string => entry !== null),
      }))
      .filter((answer) => answer.question !== '' && answer.values.length > 0)
      .slice(0, ANSWER_LIMIT),
  };
}

export function campaignValueOf(row: Pick<ImportRow, 'campaign' | 'utmCampaign'>): string | null {
  return row.campaign ?? row.utmCampaign ?? null;
}

export function externalIdsIn(value: string): string[] {
  return [...new Set(value.match(/\d{6,}/g) ?? [])];
}

export function importKeyOf(projectId: string, row: ImportRow): string {
  const content = [row.name, phoneDigitsOf(row.phone), row.email?.toLowerCase() ?? null, row.submittedAt, campaignValueOf(row), row.answers];
  return `import:${projectId}:${createHash('sha256').update(JSON.stringify(content)).digest('hex')}`;
}

export interface CampaignCatalog {
  campaigns: ReadonlyArray<{ id: string; name: string; externalId: string | null }>;
  adSets: ReadonlyMap<string, string>;
  ads: ReadonlyMap<string, { campaignId: string; adId: string }>;
}

export interface CampaignMatch {
  campaignId: string;
  adId: string | null;
}

export function matchCampaign(value: string | null, catalog: CampaignCatalog): CampaignMatch | null {
  if (!value) return null;
  const ids = externalIdsIn(value);
  for (const id of ids) {
    const campaign = catalog.campaigns.find((candidate) => candidate.externalId === id);
    if (campaign) return { campaignId: campaign.id, adId: null };
  }
  for (const id of ids) {
    const campaignId = catalog.adSets.get(id);
    if (campaignId) return { campaignId, adId: null };
  }
  for (const id of ids) {
    const ad = catalog.ads.get(id);
    if (ad) return ad;
  }
  const named = catalog.campaigns.filter((campaign) => sameCampaignName(campaign.name, value));
  return named.length === 1 ? { campaignId: named[0]!.id, adId: null } : null;
}

const STAGE_NAMES: Readonly<Record<LeadStage, readonly string[]>> = {
  NEW: ['new', 'новый', 'лид (новый)', 'lead (new)'],
  QUALIFIED: ['qualified', 'квалифицированный', 'квал. лид', 'qualified lead'],
  TARGET: ['target', 'целевой', 'целевой лид', 'target lead'],
  PROPOSAL: ['proposal', 'кп', 'коммерческое предложение'],
};

export interface OwnColumn {
  id: string;
  name: string;
}

export function matchColumn(status: string | null, own: readonly OwnColumn[]): string | null {
  const key = status?.trim().toLowerCase();
  if (!key) return null;
  const column = own.find((candidate) => candidate.name.trim().toLowerCase() === key);
  return column?.id ?? LEAD_STAGES.find((stage) => STAGE_NAMES[stage].includes(key)) ?? null;
}

export interface BoardContacts {
  emails: ReadonlySet<string>;
  phones: ReadonlySet<string>;
}

export interface ImportChoice {
  value: string | null;
  campaignId: string | null;
}

export interface ImportPlacement {
  value: string;
  columnId: string;
}

export const FIRST_COLUMN: LeadStage = 'NEW';

export interface PlannedLead {
  row: ImportRow;
  key: string;
  submittedAt: Date;
  campaignId: string | null;
  adId: string | null;
  column: string;
}

export interface ImportSkips {
  onBoard: number;
  repeated: number;
  empty: number;
}

export interface ImportPlan {
  leads: PlannedLead[];
  skipped: ImportSkips;
  undated: number;
  campaigns: Array<{ value: string | null; leads: number; campaignId: string | null }>;
  statuses: Array<{ value: string; leads: number; columnId: string | null }>;
}

export function planImport(input: {
  projectId: string;
  rows: readonly ImportRow[];
  catalog: CampaignCatalog;
  contacts: BoardContacts;
  claimed: ReadonlySet<string>;
  choices: readonly ImportChoice[];
  own?: readonly OwnColumn[];
  placements?: readonly ImportPlacement[];
  now: Date;
}): ImportPlan {
  const own = input.own ?? [];
  const placed = new Map((input.placements ?? []).map((placement) => [placement.value, placement.columnId]));
  if ([...placed.values()].some((columnId) => !isLeadStage(columnId) && !own.some((column) => column.id === columnId))) {
    throw new AppError('validation', 'A chosen column is not on this board');
  }
  const statuses = new Map<string, { leads: number; columnId: string | null }>();
  const chosen = new Map(input.choices.map((choice) => [choice.value, choice.campaignId]));
  const known = new Set(input.catalog.campaigns.map((campaign) => campaign.id));
  if ([...chosen.values()].some((campaignId) => campaignId !== null && !known.has(campaignId))) {
    throw new AppError('validation', 'A chosen campaign is not in this project');
  }
  const emails = new Set<string>();
  const phones = new Set<string>();
  const skipped: ImportSkips = { onBoard: 0, repeated: 0, empty: 0 };
  const groups = new Map<string | null, { leads: number; campaignId: string | null }>();
  const leads: PlannedLead[] = [];
  let undated = 0;
  for (const row of input.rows) {
    const email = row.email?.toLowerCase() ?? null;
    const phone = phoneDigitsOf(row.phone);
    const key = importKeyOf(input.projectId, row);
    if (!row.name && !email && !phone) {
      skipped.empty++;
      continue;
    }
    if ((email && input.contacts.emails.has(email)) || (phone && input.contacts.phones.has(phone)) || input.claimed.has(key)) {
      skipped.onBoard++;
      continue;
    }
    if ((email && emails.has(email)) || (phone && phones.has(phone))) {
      skipped.repeated++;
      continue;
    }
    if (email) emails.add(email);
    if (phone) phones.add(phone);
    const value = campaignValueOf(row);
    const match = chosen.has(value) ? { campaignId: chosen.get(value) ?? null, adId: null } : matchCampaign(value, input.catalog);
    const submittedAt = submittedAtOf(row.submittedAt, input.now);
    if (!submittedAt) undated++;
    const columnId = row.status ? placed.get(row.status) ?? matchColumn(row.status, own) : null;
    if (row.status) {
      const status = statuses.get(row.status) ?? { leads: 0, columnId };
      status.leads++;
      statuses.set(row.status, status);
    }
    leads.push({ row, key, submittedAt: submittedAt ?? input.now, campaignId: match?.campaignId ?? null, adId: match?.adId ?? null, column: columnId ?? FIRST_COLUMN });
    const group = groups.get(value) ?? { leads: 0, campaignId: match?.campaignId ?? null };
    group.leads++;
    groups.set(value, group);
  }
  return {
    leads,
    skipped,
    undated,
    campaigns: [...groups].map(([value, group]) => ({ value, ...group })),
    statuses: [...statuses].map(([value, status]) => ({ value, ...status })),
  };
}
