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
import { PrismaWebsiteKeyRepository } from "#modules/leads/infrastructure/prisma-website-key-repository.js";
import { PrismaLeadImportRepository } from "#modules/leads/infrastructure/prisma-lead-import-repository.js";
import { GoogleSheetReader } from "#modules/leads/infrastructure/google-sheet-reader.js";
import { createLeadImportUseCases } from "#modules/leads/application/lead-import-use-cases.js";
import { createLeadImportRouter } from "#modules/leads/presentation/http/lead-import-http.js";
import { RandomWebsiteKeys, createWebsiteIntakeUseCases } from "#modules/leads/application/website-intake-use-cases.js";
import { createWebsiteIntakeRouter, createWebsiteKeyRouter } from "#modules/leads/presentation/http/website-intake-http.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import { PrismaLeadRepository } from "#modules/leads/infrastructure/prisma-lead-repository.js";
import { createLeadEventDelivery } from "#modules/realtime/index.js";
import { runDetached, type Kernel } from "./kernel.js";
import type { MembersAndPresence } from "./members-presence.js";


export function wireLeads(
  { unitOfWork, ids, audit, connections, clock }: Kernel,
  { members }: Pick<MembersAndPresence, "members">,
  { projectRepository }: Pick<ClientsAndProjects, "projectRepository">,
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
  const notes = createLeadNoteUseCases({ leads: leadRepository, notes: new PrismaLeadNoteRepository(prisma, unitOfWork), audit, unitOfWork, ids, clock, publish });
  const leadIntake = createLeadIntake({
    intake: new PrismaLeadIntakeRepository(unitOfWork),
    ids,
    unitOfWork,
    publish,
  });
  const website = createWebsiteIntakeUseCases({
    keys: new PrismaWebsiteKeyRepository(prisma, unitOfWork),
    projects: projectRepository,
    tokens: new RandomWebsiteKeys(),
    intake: leadIntake,
    ids,
    audit,
    unitOfWork,
    clock,
  });
  const imports = createLeadImportUseCases({
    leads: leadRepository,
    imports: new PrismaLeadImportRepository(prisma, unitOfWork),
    sheets: new GoogleSheetReader(),
    audit,
    ids,
    unitOfWork,
    clock,
    publish,
  });
  return {
    leadIntake,
    websiteIntakeRouter: createWebsiteIntakeRouter(website),
    websiteKeyRouter: createWebsiteKeyRouter(website),
    leadRouter: createLeadRouter(leads, files, fields, records, notes),
    leadImportRouter: createLeadImportRouter(imports),
  };
}

export type Leads = ReturnType<typeof wireLeads>;
