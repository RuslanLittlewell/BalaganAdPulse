import { prisma } from "#shared/infrastructure/prisma.js";
import { createCampaignHttpRouters, createCampaignUseCases } from "#modules/campaigns/index.js";
import {
  PrismaAdRepository,
  PrismaAdSetRepository,
  PrismaCampaignRepository,
  PrismaCreativeRepository,
  PrismaProjectReach,
  S3CreativeStorage,
} from "#modules/campaigns/infrastructure/prisma-campaign-repositories.js";
import { PrismaMetricRepository } from "#modules/campaigns/infrastructure/prisma-metric-repository.js";
import { createImportWorker } from "#modules/integrations/application/import-worker.js";
import { createIntegrationUseCases } from "#modules/integrations/application/integration-use-cases.js";
import { createLeadPollWorker } from "#modules/integrations/application/lead-poll-worker.js";
import { S3CreativeFiles } from "#modules/integrations/infrastructure/creative-files.js";
import { AesCredentialCipher } from "#modules/integrations/infrastructure/credential-cipher.js";
import { GraphProvider } from "#modules/integrations/infrastructure/graph-provider.js";
import { PrismaAdLocator } from "#modules/integrations/infrastructure/prisma-ad-locator.js";
import { PrismaCreativeStore } from "#modules/integrations/infrastructure/prisma-creative-store.js";
import { PrismaImportJobs } from "#modules/integrations/infrastructure/prisma-import-jobs.js";
import { PrismaIntegrationRepository } from "#modules/integrations/infrastructure/prisma-integration-repository.js";
import { PrismaLeadPollJobs } from "#modules/integrations/infrastructure/prisma-lead-poll-jobs.js";
import { createAdPreviewRouter, createIntegrationRouter } from "#modules/integrations/presentation/http/integration-http.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import type { Kernel } from "./kernel.js";
import type { Leads } from "./leads.js";

export function wireCampaignsAndIntegrations(
  { unitOfWork, clock, audit }: Kernel,
  { projectRepository, leadIntake }: Pick<ClientsAndProjects, "projectRepository"> & Pick<Leads, "leadIntake">,
) {
  const cipher = new AesCredentialCipher(process.env.INTEGRATION_ENCRYPTION_KEY);
  const provider = new GraphProvider(process.env.META_GRAPH_VERSION ?? "v22.0");
  const campaignRepository = new PrismaCampaignRepository(prisma);
  const integrations = createIntegrationUseCases({
    repository: new PrismaIntegrationRepository(prisma, unitOfWork),
    cipher,
    provider,
    projects: projectRepository,
    ads: new PrismaAdLocator(prisma),
    creatives: new PrismaCreativeStore(prisma),
    files: new S3CreativeFiles(),
    clock,
    unitOfWork,
    audit,
  });
  const campaigns = createCampaignUseCases({
    campaigns: campaignRepository,
    adSets: new PrismaAdSetRepository(prisma),
    ads: new PrismaAdRepository(prisma),
    creatives: new PrismaCreativeRepository(prisma),
    creativeFiles: new S3CreativeStorage(),
    projects: new PrismaProjectReach(prisma),
    metrics: new PrismaMetricRepository(prisma),
  });
  return {
    campaignRepository,
    ...createCampaignHttpRouters(campaigns),
    integrationRouter: createIntegrationRouter(integrations),
    adPreviewRouter: createAdPreviewRouter(integrations),
    importWorker: createImportWorker({ jobs: new PrismaImportJobs(prisma), cipher, provider, clock, leads: leadIntake }),
    leadPollWorker: createLeadPollWorker({
      jobs: new PrismaLeadPollJobs(prisma, unitOfWork),
      cipher,
      provider,
      inbox: leadIntake,
      unitOfWork,
      clock,
    }),
  };
}

export type CampaignsAndIntegrations = ReturnType<typeof wireCampaignsAndIntegrations>;
