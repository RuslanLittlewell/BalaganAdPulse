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
import { createGoogleUseCases } from "#modules/integrations/application/google-use-cases.js";
import { createIntegrationUseCases } from "#modules/integrations/application/integration-use-cases.js";
import { createLeadPollWorker } from "#modules/integrations/application/lead-poll-worker.js";
import { S3CreativeFiles } from "#modules/integrations/infrastructure/creative-files.js";
import { AesCredentialCipher } from "#modules/integrations/infrastructure/credential-cipher.js";
import { GoogleAdsProvider } from "#modules/integrations/infrastructure/google-ads-provider.js";
import { GoogleOAuth } from "#modules/integrations/infrastructure/google-oauth.js";
import { PrismaGoogleAuthorizations } from "#modules/integrations/infrastructure/prisma-google-authorizations.js";
import { GraphProvider } from "#modules/integrations/infrastructure/graph-provider.js";
import { PrismaAdLocator } from "#modules/integrations/infrastructure/prisma-ad-locator.js";
import { PrismaCreativeStore } from "#modules/integrations/infrastructure/prisma-creative-store.js";
import { PrismaImportJobs } from "#modules/integrations/infrastructure/prisma-import-jobs.js";
import { PrismaIntegrationRepository } from "#modules/integrations/infrastructure/prisma-integration-repository.js";
import { PrismaLeadPollJobs } from "#modules/integrations/infrastructure/prisma-lead-poll-jobs.js";
import { addGoogleIntegrationRoutes, createGoogleCallbackRouter } from "#modules/integrations/presentation/http/google-integration-http.js";
import { createAdPreviewRouter, createIntegrationRouter } from "#modules/integrations/presentation/http/integration-http.js";
import { config } from "#shared/infrastructure/config.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import type { Kernel } from "./kernel.js";
import type { Leads } from "./leads.js";
import type { Notifications } from "./notifications.js";

export function wireCampaignsAndIntegrations(
  { unitOfWork, clock, audit }: Kernel,
  { projectRepository, leadIntake }: Pick<ClientsAndProjects, "projectRepository"> & Pick<Leads, "leadIntake">,
  { imports }: Pick<Notifications, "imports">,
) {
  const cipher = new AesCredentialCipher(process.env.INTEGRATION_ENCRYPTION_KEY);
  const provider = new GraphProvider(process.env.META_GRAPH_VERSION ?? "v22.0");
  const campaignRepository = new PrismaCampaignRepository(prisma);
  const integrationRepository = new PrismaIntegrationRepository(prisma, unitOfWork);
  const oauth = config.googleAds ? new GoogleOAuth(config.googleAds) : null;
  const googleAds = config.googleAds && oauth ? new GoogleAdsProvider(oauth, config.googleAds) : null;
  const integrations = createIntegrationUseCases({
    repository: integrationRepository,
    cipher,
    provider,
    projects: projectRepository,
    ads: new PrismaAdLocator(prisma),
    creatives: new PrismaCreativeStore(prisma),
    files: new S3CreativeFiles(),
    ...(googleAds ? { googleCreatives: googleAds } : {}),
    clock,
    unitOfWork,
    audit,
  });
  const googleIntegrations = createGoogleUseCases({
    repository: integrationRepository,
    cipher,
    projects: projectRepository,
    clock,
    unitOfWork,
    audit,
    authorizations: new PrismaGoogleAuthorizations(prisma),
    google: oauth && googleAds
      ? {
          authorizeUrl: (state) => oauth.authorizeUrl(state),
          redeem: (code) => oauth.redeem(code),
          accounts: (refreshToken) => googleAds.accounts(refreshToken),
          account: (accountId, login, refreshToken) => googleAds.account(accountId, login, refreshToken),
        }
      : null,
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
    integrationRouter: createIntegrationRouter(integrations, (router) => addGoogleIntegrationRoutes(router, googleIntegrations)),
    googleCallbackRouter: createGoogleCallbackRouter(googleIntegrations, config.appUrl),
    adPreviewRouter: createAdPreviewRouter(integrations),
    importWorker: createImportWorker({
      jobs: new PrismaImportJobs(prisma),
      cipher,
      providers: {
        ...(googleAds ? { GOOGLE: googleAds } : {}),
        META: { snapshot: (account, token, now, signal) => provider.snapshot(account.accountId, token, account.currency, now, signal) } },
      clock, leads: leadIntake, imports }),
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
