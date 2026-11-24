import { can } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator, TransactionContext, UnitOfWork } from '#shared/application/index.js';
import type { AuditWriter } from '#modules/audit/index.js';
import { MAX_LEAD_NOTE_LENGTH, type LeadNoteRecord } from '../domain/lead-note.js';
import type { LeadEvent, LeadNoteRepository, LeadRepository } from './ports.js';

const NOTE_NOT_FOUND = 'Note not found';

export function createLeadNoteUseCases(d: {
  leads: LeadRepository;
  notes: LeadNoteRepository;
  audit: AuditWriter;
  unitOfWork: UnitOfWork;
  ids: IdGenerator;
  clock: { now(): Date };
  publish: (event: LeadEvent) => void;
}) {
  async function leadOf(actor: ActorContext, board: string, leadId: string) {
    if (!await d.leads.reaches(actor, board) || !can(actor, 'read', 'lead')) throw new AppError('not-found', 'Lead not found');
    const lead = await d.leads.leadOnBoard(actor, board, leadId);
    if (!lead) throw new AppError('not-found', 'Lead not found');
    return lead;
  }
  function assertMayWrite(actor: ActorContext) {
    if (!can(actor, 'update', 'lead')) throw new AppError('forbidden', 'Your role may not change a lead');
  }
  function textOf(body: string) {
    const text = body.trim();
    if (text.length === 0) throw new AppError('validation', 'A note needs text');
    if (text.length > MAX_LEAD_NOTE_LENGTH) throw new AppError('validation', `A note holds at most ${MAX_LEAD_NOTE_LENGTH} characters`);
    return text;
  }
  type Lead = Awaited<ReturnType<typeof leadOf>>;
  const record = (context: TransactionContext, actor: ActorContext, lead: Lead, action: 'CREATE' | 'UPDATE' | 'DELETE', noteId: string, summary: string) =>
    d.audit.append(context, {
      action, entityType: 'lead-note', entityId: noteId, clientId: lead.clientId, projectId: lead.projectId, leadId: lead.id, summary,
    }, actor);
  const announce = (actor: ActorContext, board: string, leadId: string) =>
    d.publish({ kind: 'crm.changed', orgId: actor.orgId, board, resources: ['notes'], leadId });

  return {
    async list(actor: ActorContext, board: string, leadId: string): Promise<LeadNoteRecord[]> {
      await leadOf(actor, board, leadId);
      return d.notes.list(leadId);
    },

    async add(actor: ActorContext, board: string, leadId: string, input: { body: string }): Promise<LeadNoteRecord> {
      const lead = await leadOf(actor, board, leadId);
      assertMayWrite(actor);
      const body = textOf(input.body);
      const note = await d.unitOfWork.run(async (context) => {
        const created = await d.notes.create(context, { id: d.ids.generate(), orgId: actor.orgId, leadId, authorId: actor.membershipId, body });
        await record(context, actor, lead, 'CREATE', created.id, `Added a note to lead “${lead.name}”`);
        return created;
      });
      announce(actor, board, leadId);
      return note;
    },

    async edit(actor: ActorContext, board: string, leadId: string, noteId: string, input: { body: string }): Promise<LeadNoteRecord> {
      const lead = await leadOf(actor, board, leadId);
      const found = await d.notes.find(leadId, noteId);
      if (!found) throw new AppError('not-found', NOTE_NOT_FOUND);
      if (found.author?.id !== actor.membershipId) throw new AppError('forbidden', 'Only the author edits a note');
      const body = textOf(input.body);
      const note = await d.unitOfWork.run(async (context) => {
        const edited = await d.notes.edit(context, noteId, { body, editedAt: d.clock.now() });
        await record(context, actor, lead, 'UPDATE', noteId, `Edited a note on lead “${lead.name}”`);
        return edited;
      });
      announce(actor, board, leadId);
      return note;
    },

    async remove(actor: ActorContext, board: string, leadId: string, noteId: string): Promise<void> {
      const lead = await leadOf(actor, board, leadId);
      const found = await d.notes.find(leadId, noteId);
      if (!found) throw new AppError('not-found', NOTE_NOT_FOUND);
      if (found.author?.id !== actor.membershipId && actor.role !== 'ADMIN') throw new AppError('forbidden', 'Only the author or an admin deletes a note');
      await d.unitOfWork.run(async (context) => {
        await d.notes.delete(context, noteId);
        await record(context, actor, lead, 'DELETE', noteId, `Deleted a note on lead “${lead.name}”`);
      });
      announce(actor, board, leadId);
    },
  };
}
export type LeadNoteUseCases = ReturnType<typeof createLeadNoteUseCases>;
