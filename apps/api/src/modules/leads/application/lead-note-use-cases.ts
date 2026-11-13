import { can } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator } from '#shared/application/index.js';
import { MAX_LEAD_NOTE_LENGTH, type LeadNoteRecord } from '../domain/lead-note.js';
import type { LeadEvent, LeadNoteRepository, LeadRepository } from './ports.js';

const NOTE_NOT_FOUND = 'Note not found';

export function createLeadNoteUseCases(d: {
  leads: LeadRepository;
  notes: LeadNoteRepository;
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
  const announce = (actor: ActorContext, board: string, leadId: string) =>
    d.publish({ kind: 'crm.changed', orgId: actor.orgId, board, resources: ['notes'], leadId });

  return {
    async list(actor: ActorContext, board: string, leadId: string): Promise<LeadNoteRecord[]> {
      await leadOf(actor, board, leadId);
      return d.notes.list(leadId);
    },

    async add(actor: ActorContext, board: string, leadId: string, input: { body: string }): Promise<LeadNoteRecord> {
      await leadOf(actor, board, leadId);
      assertMayWrite(actor);
      const note = await d.notes.create({ id: d.ids.generate(), orgId: actor.orgId, leadId, authorId: actor.membershipId, body: textOf(input.body) });
      announce(actor, board, leadId);
      return note;
    },

    async edit(actor: ActorContext, board: string, leadId: string, noteId: string, input: { body: string }): Promise<LeadNoteRecord> {
      await leadOf(actor, board, leadId);
      const found = await d.notes.find(leadId, noteId);
      if (!found) throw new AppError('not-found', NOTE_NOT_FOUND);
      if (found.author?.id !== actor.membershipId) throw new AppError('forbidden', 'Only the author edits a note');
      const note = await d.notes.edit(noteId, { body: textOf(input.body), editedAt: d.clock.now() });
      announce(actor, board, leadId);
      return note;
    },

    async remove(actor: ActorContext, board: string, leadId: string, noteId: string): Promise<void> {
      await leadOf(actor, board, leadId);
      const found = await d.notes.find(leadId, noteId);
      if (!found) throw new AppError('not-found', NOTE_NOT_FOUND);
      if (found.author?.id !== actor.membershipId && actor.role !== 'ADMIN') throw new AppError('forbidden', 'Only the author or an admin deletes a note');
      await d.notes.delete(noteId);
      announce(actor, board, leadId);
    },
  };
}
export type LeadNoteUseCases = ReturnType<typeof createLeadNoteUseCases>;
