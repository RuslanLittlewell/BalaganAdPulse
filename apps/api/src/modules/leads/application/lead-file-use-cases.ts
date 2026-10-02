import { can } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator, UnitOfWork } from '#shared/application/index.js';
import type { AuditWriter } from '../../audit/index.js';
import { fileNameOf, MAX_LEAD_FILE_BYTES, safeContentType, type LeadFileRecord } from '../domain/lead-file.js';
import type { LeadEvent, LeadFileRepository, LeadFileStorage, LeadRepository } from './ports.js';

const FILE_NOT_FOUND = 'File not found';

export function createLeadFileUseCases(d: {
  leads: LeadRepository;
  files: LeadFileRepository;
  storage: LeadFileStorage;
  audit: AuditWriter;
  ids: IdGenerator;
  unitOfWork: UnitOfWork;
  publish: (event: LeadEvent) => void;
}) {
  async function leadOf(actor: ActorContext, board: string, leadId: string) {
    if (!await d.leads.reaches(actor, board) || !can(actor, 'read', 'lead')) throw new AppError('not-found', 'Lead not found');
    const lead = await d.leads.leadOnBoard(actor.orgId, board, leadId);
    if (!lead) throw new AppError('not-found', 'Lead not found');
    return lead;
  }
  async function fileOf(actor: ActorContext, board: string, leadId: string, fileId: string) {
    await leadOf(actor, board, leadId);
    const file = await d.files.find(leadId, fileId);
    if (!file) throw new AppError('not-found', FILE_NOT_FOUND);
    return file;
  }
  function assertMayChange(actor: ActorContext) {
    if (!can(actor, 'update', 'lead')) throw new AppError('forbidden', 'Your role may not change a lead');
  }

  return {
    async list(actor: ActorContext, board: string, leadId: string): Promise<LeadFileRecord[]> {
      await leadOf(actor, board, leadId);
      return d.files.list(leadId);
    },

    async attach(actor: ActorContext, board: string, leadId: string, upload: { bytes: Buffer; name: string; contentType?: string }): Promise<LeadFileRecord> {
      const lead = await leadOf(actor, board, leadId);
      assertMayChange(actor);
      if (upload.bytes.length > MAX_LEAD_FILE_BYTES) throw new AppError('validation', 'File is too large; the limit is 20 MB');
      const id = d.ids.generate();
      const storageKey = `leads/files/${id}`;
      const contentType = safeContentType(upload.contentType);
      const name = fileNameOf(upload.name);
      await d.storage.put(storageKey, upload.bytes, contentType);
      try {
        const file = await d.unitOfWork.run(async (context) => {
          const created = await d.files.create(context, {
            id, orgId: actor.orgId, leadId, name, contentType, bytes: upload.bytes.length, storageKey, uploaderId: actor.membershipId,
          });
          await d.audit.append(context, {
            action: 'UPDATE', entityType: 'lead', entityId: leadId, clientId: lead.clientId, projectId: lead.projectId,
            summary: 'UPDATE lead', changes: { fileAdded: { id, name } },
          }, actor);
          return created;
        });
        d.publish({ kind: 'crm.changed', orgId: actor.orgId, board });
        return file;
      } catch (error) {
        await d.storage.remove([storageKey]);
        throw error;
      }
    },

    async read(actor: ActorContext, board: string, leadId: string, fileId: string) {
      const file = await fileOf(actor, board, leadId, fileId);
      const stored = await d.storage.get(file.storageKey);
      return { name: file.name, body: stored.body };
    },

    async remove(actor: ActorContext, board: string, leadId: string, fileId: string): Promise<void> {
      const lead = await leadOf(actor, board, leadId);
      assertMayChange(actor);
      const file = await d.files.find(leadId, fileId);
      if (!file) throw new AppError('not-found', FILE_NOT_FOUND);
      await d.unitOfWork.run(async (context) => {
        await d.files.delete(context, fileId);
        await d.audit.append(context, {
          action: 'UPDATE', entityType: 'lead', entityId: leadId, clientId: lead.clientId, projectId: lead.projectId,
          summary: 'UPDATE lead', changes: { fileRemoved: { id: file.id, name: file.name } },
        }, actor);
      });
      await d.storage.remove([file.storageKey]);
      d.publish({ kind: 'crm.changed', orgId: actor.orgId, board });
    },
  };
}
export type LeadFileUseCases = ReturnType<typeof createLeadFileUseCases>;
