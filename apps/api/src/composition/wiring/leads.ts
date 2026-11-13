import { prisma } from "#shared/infrastructure/prisma.js";
import {
  createCrmRecordUseCases,
  createLeadFieldUseCases,
  createLeadFileUseCases,
  createLeadIntake,
  createLeadNoteUseCases,
  createLeadRouter,
  createLeadUseCases,
  type LeadEvent,
} from "#modules/leads/index.js";
import { PrismaLeadFileRepository, S3LeadFileStorage } from "#modules/leads/infrastructure/prisma-lead-file-repository.js";
import { PrismaLeadNoteRepository } from "#modules/leads/infrastructure/prisma-lead-note-repository.js";
import { PrismaLeadFieldRepository } from "#modules/leads/infrastructure/prisma-lead-field-repository.js";
import { PrismaCrmRecordRepository } from "#modules/leads/infrastructure/prisma-crm-record-repository.js";
import { PrismaLeadIntakeRepository } from "#modules/leads/infrastructure/prisma-lead-intake-repository.js";
import { PrismaLeadRepository } from "#modules/leads/infrastructure/prisma-lead-repository.js";
import { createLeadEventDelivery } from "#modules/realtime/index.js";
import { runDetached, type Kernel } from "./kernel.js";
import type { MembersAndPresence } from "./members-presence.js";


export function wireLeads(
  { unitOfWork, ids, audit, connections, clock }: Kernel,
  { members }: Pick<MembersAndPresence, "members">,
) {
  const leadRepository = new PrismaLeadRepository(prisma, unitOfWork);
  const delivery = createLeadEventDelivery({ registry: connections, members, boards: leadRepository });
  const publish = (event: LeadEvent) => runDetached("Failed to deliver a CRM event:", delivery.deliver(event));
  const storage = new S3LeadFileStorage();
  const fieldRepository = new PrismaLeadFieldRepository(prisma, unitOfWork);
  const recordRepository = new PrismaCrmRecordRepository(prisma, unitOfWork);
  const leads = createLeadUseCases({ leads: leadRepository, fields: fieldRepository, records: recordRepository, storage, audit, ids, unitOfWork, publish });
  const records = createCrmRecordUseCases({ records: recordRepository, audit, ids, unitOfWork, publish });
  const fields = createLeadFieldUseCases({ leads: leadRepository, fields: fieldRepository, audit, ids, unitOfWork, publish });
  const files = createLeadFileUseCases({
    leads: leadRepository,
    files: new PrismaLeadFileRepository(prisma, unitOfWork),
    storage,
    audit,
    ids,
    unitOfWork,
    publish,
  });
  const notes = createLeadNoteUseCases({ leads: leadRepository, notes: new PrismaLeadNoteRepository(prisma), ids, clock, publish });
  return {
    leadIntake: createLeadIntake({
      intake: new PrismaLeadIntakeRepository(unitOfWork),
      ids,
      unitOfWork,
      publish,
    }),
    leadRouter: createLeadRouter(leads, files, fields, records, notes),
  };
}

export type Leads = ReturnType<typeof wireLeads>;
