import { prisma } from "#shared/infrastructure/prisma.js";
import { CryptoInvitationCodeGenerator } from "#modules/invites/index.js";
import { PrismaInviteRepository } from "#modules/invites/infrastructure/prisma-invite-repository.js";
import { createPlatformRouter, createPlatformUseCases } from "#modules/platform/index.js";
import { PrismaOrganizationRegistry } from "#modules/platform/infrastructure/prisma-organization-registry.js";
import { PrismaPlatformAccounts } from "#modules/platform/infrastructure/prisma-platform-accounts.js";
import type { Kernel } from "./kernel.js";

export function wirePlatform({ unitOfWork, clock, ids }: Kernel) {
  const accounts = new PrismaPlatformAccounts(prisma);
  const invites = new PrismaInviteRepository(prisma, unitOfWork);
  const codes = new CryptoInvitationCodeGenerator();
  const platform = createPlatformUseCases({
    organizations: new PrismaOrganizationRegistry(prisma, unitOfWork),
    administrators: accounts,
    accounts,
    invitations: {
      issue: async (context, { orgId, email }) => {
        const invite = await invites.create(context, {
          id: ids.generate(),
          orgId,
          code: codes.generate(),
          registrationType: "EMPLOYEE",
          role: "ADMIN",
          projectIds: [],
          clientId: null,
          email,
          expiresAt: null,
          createdById: null,
        });
        return { code: invite.code };
      },
    },
    ids,
    clock,
    unitOfWork,
  });
  return { platformRouter: createPlatformRouter(platform) };
}
