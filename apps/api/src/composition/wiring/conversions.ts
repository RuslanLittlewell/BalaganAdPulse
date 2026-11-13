import { prisma } from "#shared/infrastructure/prisma.js";
import { createConversionsApiUseCases, createConversionsRouter, createConversionWorker } from "#modules/conversions/index.js";
import { MetaConversionsApi } from "#modules/conversions/infrastructure/meta-conversions-api.js";
import { PrismaConversionJobs } from "#modules/conversions/infrastructure/prisma-conversion-jobs.js";
import { PrismaDatasetRepository } from "#modules/conversions/infrastructure/prisma-dataset-repository.js";
import { AesCredentialCipher } from "#modules/integrations/infrastructure/credential-cipher.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import type { Kernel } from "./kernel.js";
import type { Leads } from "./leads.js";

export function wireConversions(
  { unitOfWork, clock, audit, ids }: Kernel,
  { projectRepository }: Pick<ClientsAndProjects, "projectRepository">,
  { conversionReach }: Pick<Leads, "conversionReach">,
) {
  const cipher = new AesCredentialCipher(process.env.INTEGRATION_ENCRYPTION_KEY);
  const api = new MetaConversionsApi(process.env.META_GRAPH_VERSION ?? "v22.0");
  const jobs = new PrismaConversionJobs(prisma, unitOfWork);
  const conversions = createConversionsApiUseCases({
    datasets: new PrismaDatasetRepository(prisma, unitOfWork),
    queue: jobs,
    reach: conversionReach,
    api,
    cipher,
    projects: projectRepository,
    audit,
    ids,
    unitOfWork,
    clock,
  });
  return {
    conversionsRouter: createConversionsRouter(conversions),
    conversionWorker: createConversionWorker({ jobs, reach: conversionReach, api, cipher, unitOfWork, clock }),
  };
}

export type Conversions = ReturnType<typeof wireConversions>;
