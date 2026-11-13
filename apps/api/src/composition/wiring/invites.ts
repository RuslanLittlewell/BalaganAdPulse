import { prisma } from "#shared/infrastructure/prisma.js";
import {
  CryptoInvitationCodeGenerator,
  createInviteRouter,
  createInviteUseCases,
  createRegistrationResolverRouter,
} from "#modules/invites/index.js";
import { PrismaInviteRepository } from "#modules/invites/infrastructure/prisma-invite-repository.js";
import { PrismaInvitationOrganizations } from "#modules/invites/infrastructure/prisma-invitation-organizations.js";
import { PrismaInvitationProjectReach } from "#modules/invites/infrastructure/prisma-invitation-project-reach.js";
import { PrismaInvitationProjectAccess, PrismaMembershipEnrolment } from "#modules/members/index.js";
import { PrismaInvitationCampaignReach } from "#modules/invites/infrastructure/prisma-invitation-campaign-reach.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import type { Kernel } from "./kernel.js";

export function wireInvites(
  { unitOfWork, clock, ids, tariffs }: Kernel,
  { clientReach, clientRepository, projectRepository }:
    Pick<ClientsAndProjects, "clientReach" | "clientRepository" | "projectRepository">,
) {
  const invites = createInviteUseCases({
    invites: new PrismaInviteRepository(prisma, unitOfWork),
    memberships: new PrismaMembershipEnrolment(unitOfWork),
    projects: new PrismaInvitationProjectReach(prisma),
    organizations: new PrismaInvitationOrganizations(prisma),
    clients: clientReach,
    campaigns: new PrismaInvitationCampaignReach(prisma),
    projectAccess: new PrismaInvitationProjectAccess(unitOfWork),
    clientDirectory: {
      create: async (context, input) => {
        const { orgId, ...contact } = input;
        const created = await clientRepository.create(
          context, { ...contact, id: ids.generate(), orgId }, undefined,
        );
        return created.id;
      },
    },
    projectDirectory: {
      create: async (context, input) => {
        const { clientId, ...details } = input;
        const created = await projectRepository.create(context, {
          ...details,
          clientId,
          id: ids.generate(),
          position: await projectRepository.countForClient(clientId),
        });
        return created.id;
      },
    },
    tariffs,
    clock,
    ids,
    codes: new CryptoInvitationCodeGenerator(),
    unitOfWork,
  });
  return {
    redeem: invites.redeem,
    inviteRouter: createInviteRouter(invites),
    registrationResolverRouter: createRegistrationResolverRouter(invites),
  };
}
