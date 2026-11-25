import { can } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator, TransactionContext, UnitOfWork } from '#shared/application/index.js';
import type { AuditWriter } from '#modules/audit/index.js';
import {
  campaignValueOf,
  externalIdsIn,
  importKeyOf,
  importRefused,
  normalizedRow,
  planImport,
  sheetExportUrl,
  tableOf,
  type BoardContacts,
  type CampaignCatalog,
  type ImportChoice,
  type ImportPlacement,
  type ImportRow,
  type OwnColumn,
  type ImportSkips,
  type ImportTable,
  type PlannedLead,
} from '../domain/lead-import.js';
import { isLeadStage, LEAD_STAGE_NAMES } from '../domain/lead.js';
import type { LeadEvent, LeadRepository } from './ports.js';

export interface ImportedLeadWrite extends PlannedLead {
  id: string;
  position: number;
}

export interface LeadImportRepository {
  project(projectId: string): Promise<{ clientId: string; name: string }>;
  catalog(projectId: string, externalIds: readonly string[], context?: TransactionContext): Promise<CampaignCatalog>;
  contacts(projectId: string, context?: TransactionContext): Promise<BoardContacts>;
  ownColumns(projectId: string, context?: TransactionContext): Promise<OwnColumn[]>;
  claimed(orgId: string, keys: readonly string[], context?: TransactionContext): Promise<Set<string>>;
  lock(context: TransactionContext, orgId: string, projectId: string): Promise<void>;
  write(context: TransactionContext, input: { orgId: string; projectId: string; clientId: string; leads: readonly ImportedLeadWrite[] }): Promise<void>;
}

export interface SheetReader {
  read(address: string): Promise<string>;
}

export type ImportSource = { csv: string } | { url: string };

export interface ImportPreview {
  added: number;
  skipped: ImportSkips;
  undated: number;
  campaigns: Array<{ value: string | null; leads: number; campaign: { id: string; name: string } | null }>;
  statuses: Array<{ value: string; leads: number; column: { id: string; name: string } | null }>;
}

export interface ImportOutcome {
  added: number;
  skipped: ImportSkips;
}

export function createLeadImportUseCases(d: {
  leads: Pick<LeadRepository, 'reaches'>;
  imports: LeadImportRepository;
  sheets: SheetReader;
  audit: AuditWriter;
  ids: IdGenerator;
  unitOfWork: UnitOfWork;
  clock: { now(): Date };
  publish: (event: LeadEvent) => void;
}) {
  async function authorize(actor: ActorContext, board: string) {
    if (!(await d.leads.reaches(actor, board))) throw new AppError('not-found', 'Board not found');
    if (!can(actor, 'create', 'lead-import')) throw new AppError('forbidden', 'Your role may not import leads');
  }

  async function plan(actor: ActorContext, board: string, received: readonly ImportRow[], choices: readonly ImportChoice[], placements: readonly ImportPlacement[], context?: TransactionContext) {
    const rows = received.map(normalizedRow);
    const ids = [...new Set(rows.flatMap((row) => externalIdsIn(campaignValueOf(row) ?? '')))];
    const keys = rows.map((row) => importKeyOf(board, row));
    const catalog = await d.imports.catalog(board, ids, context);
    const contacts = await d.imports.contacts(board, context);
    const claimed = await d.imports.claimed(actor.orgId, keys, context);
    const own = await d.imports.ownColumns(board, context);
    return { catalog, own, plan: planImport({ projectId: board, rows, catalog, contacts, claimed, choices, own, placements, now: d.clock.now() }) };
  }

  return {
    async table(actor: ActorContext, board: string, source: ImportSource): Promise<ImportTable> {
      await authorize(actor, board);
      if ('csv' in source) return tableOf(source.csv);
      const address = sheetExportUrl(source.url);
      if (!address) throw importRefused('NOT_A_SHEET', 'The link is not a Google Sheet');
      return tableOf(await d.sheets.read(address));
    },

    async preview(actor: ActorContext, board: string, rows: readonly ImportRow[]): Promise<ImportPreview> {
      await authorize(actor, board);
      const { catalog, own, plan: planned } = await plan(actor, board, rows, [], []);
      const names = new Map(catalog.campaigns.map((campaign) => [campaign.id, campaign.name]));
      const columnName = (id: string) => (isLeadStage(id) ? LEAD_STAGE_NAMES[id] : own.find((column) => column.id === id)?.name ?? '');
      return {
        added: planned.leads.length,
        skipped: planned.skipped,
        undated: planned.undated,
        campaigns: planned.campaigns.map(({ value, leads, campaignId }) => ({
          value,
          leads,
          campaign: campaignId ? { id: campaignId, name: names.get(campaignId) ?? '' } : null,
        })),
        statuses: planned.statuses.map(({ value, leads, columnId }) => ({
          value,
          leads,
          column: columnId ? { id: columnId, name: columnName(columnId) } : null,
        })),
      };
    },

    async run(actor: ActorContext, board: string, rows: readonly ImportRow[], choices: readonly ImportChoice[], placements: readonly ImportPlacement[] = []): Promise<ImportOutcome> {
      await authorize(actor, board);
      const project = await d.imports.project(board);
      const planned = await d.unitOfWork.run(async (context) => {
        await d.imports.lock(context, actor.orgId, board);
        const { plan: outcome } = await plan(actor, board, rows, choices, placements, context);
        if (outcome.leads.length === 0) return outcome;
        const taken = new Map<string, number>();
        const leads = [...outcome.leads]
          .sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())
          .map((lead) => {
            const position = taken.get(lead.column) ?? 0;
            taken.set(lead.column, position + 1);
            return { ...lead, id: d.ids.generate(), position };
          });
        await d.imports.write(context, { orgId: actor.orgId, projectId: board, clientId: project.clientId, leads });
        await d.audit.append(context, {
          action: 'UPDATE',
          entityType: 'project',
          entityId: board,
          clientId: project.clientId,
          projectId: board,
          summary: `Imported ${leads.length} leads into project “${project.name}”`,
          changes: { leadsImported: leads.length },
        }, actor);
        return outcome;
      });
      if (planned.leads.length > 0) d.publish({ kind: 'crm.changed', orgId: actor.orgId, board, resources: ['leads', 'records', 'counts'] });
      return { added: planned.leads.length, skipped: planned.skipped };
    },
  };
}

export type LeadImportUseCases = ReturnType<typeof createLeadImportUseCases>;
