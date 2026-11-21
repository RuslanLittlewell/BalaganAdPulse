import { prisma } from "#shared/infrastructure/prisma.js";
import { config } from "#shared/infrastructure/config.js";
import {
  createBitrix24Router,
  createBitrix24UseCases,
  createBitrix24WebhookRouter,
  createBitrix24Worker,
  createSyncEngine,
} from "#modules/bitrix24/index.js";
import { Bitrix24RestClient } from "#modules/bitrix24/infrastructure/bitrix24-rest-client.js";
import type { Bitrix24ApiFactory } from "#modules/bitrix24/index.js";
import { Bitrix24Secrets } from "#modules/bitrix24/infrastructure/bitrix24-secrets.js";
import { PrismaConnectionRepository } from "#modules/bitrix24/infrastructure/prisma-connection-repository.js";
import { PrismaSyncStore } from "#modules/bitrix24/infrastructure/prisma-sync-store.js";
import { createPublicHostCheck } from "#modules/bitrix24/infrastructure/public-host.js";
import { SafeFetcher } from "#modules/seo/infrastructure/safe-fetcher.js";
import type { Leads } from "./leads.js";
import type { Kernel } from "./kernel.js";

export function wireBitrix24({ clock }: Kernel, { leadIntake }: Pick<Leads, "leadIntake">) {
  const addresses = new SafeFetcher("AdPulse Bitrix24");
  const isPublicHost = createPublicHostCheck((address) => addresses.isReserved(address));
  const apis: Bitrix24ApiFactory = { open: (base) => new Bitrix24RestClient(base, { isPublicHost }) };
  const connections = new PrismaConnectionRepository(prisma);
  const secrets = new Bitrix24Secrets(process.env.INTEGRATION_ENCRYPTION_KEY);
  const store = new PrismaSyncStore(prisma);
  const useCases = createBitrix24UseCases({ connections, secrets, apis, clock, appUrl: config.appUrl, isPublicHost });
  const engine = createSyncEngine({
    store,
    announce: { leadsChanged: (orgId, projectId) => leadIntake.announce({ orgId, projectId }) },
  });
  return {
    bitrix24Router: createBitrix24Router(useCases),
    bitrix24WebhookRouter: createBitrix24WebhookRouter(useCases),
    bitrix24Worker: createBitrix24Worker({ connections, store, engine, apis, secrets, clock }),
  };
}
