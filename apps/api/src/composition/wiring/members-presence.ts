import { prisma } from "#shared/infrastructure/prisma.js";
import { PrismaUserRepository } from "#modules/identity/infrastructure/prisma-identity-repositories.js";
import {
  createActorResolution,
  createMemberRouter,
  createMemberUseCases,
  createSessionRouter,
} from "#modules/members/index.js";
import { PrismaAccessRepository } from "#modules/members/infrastructure/prisma-access-repository.js";
import { S3MemberAvatarStorage } from "#modules/members/infrastructure/member-avatar-storage.js";
import { PrismaMemberDirectory } from "#modules/members/infrastructure/prisma-member-directory.js";
import { PrismaMembershipDirectory } from "#modules/members/infrastructure/prisma-membership-directory.js";
import { PrismaOrganizationDirectory } from "#modules/members/infrastructure/prisma-organization-directory.js";
import {
  createPresenceRegistry,
  createPresenceService,
  createPresenceTouch,
} from "#modules/presence/index.js";
import { createPresenceDelivery, type Connection } from "#modules/realtime/index.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import { runDetached, type Kernel } from "./kernel.js";

export function wireMembersAndPresence(
  { unitOfWork, connections }: Kernel,
  { clients }: Pick<ClientsAndProjects, "clients">,
) {
  const users = new PrismaUserRepository(prisma, unitOfWork);
  const memberDirectory = new PrismaMemberDirectory(prisma, unitOfWork);
  const members = createMemberUseCases({
    memberships: new PrismaMembershipDirectory(prisma),
    organizations: new PrismaOrganizationDirectory(prisma),
    users: {
      findById: async (id) => {
        const user = await users.findById(id);
        return user && { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    },
    clients: { reachableClientIds: clients.reachableIds },
    directory: memberDirectory,
    access: new PrismaAccessRepository(prisma, unitOfWork),
    avatars: new S3MemberAvatarStorage(),
    unitOfWork,
  });
  const presence = createPresenceRegistry();
  const presenceDelivery = createPresenceDelivery({
    connections,
    presence,
    members,
    clients: { reachableIds: clients.reachableIds },
  });
  const presenceService = createPresenceService({
    registry: presence,
    profiles: {
      describe: async (actor) => {
        const [member, clientIds] = await Promise.all([
          memberDirectory.findInOrg(actor.orgId, actor.membershipId),
          clients.reachableIds(actor),
        ]);
        return { image: member?.image ?? null, clientIds };
      },
    },
    announce: {
      joined: (person) => runDetached("Failed to announce an arrival:", presenceDelivery.deliverJoined(person)),
      left: (person) => runDetached("Failed to announce a departure:", presenceDelivery.deliverLeft(person)),
    },
  });
  return {
    members,
    presence,
    leave: (userId: string) => { presenceService.leave(userId); },
    actorResolution: createActorResolution(members),
    sessionRouter: createSessionRouter(members),
    memberRouter: createMemberRouter(members),
    presenceTouch: createPresenceTouch(presenceService),
    greetPresence: (connection: Connection) =>
      runDetached("Failed to hand over the presence roster:", presenceDelivery.greet(connection)),
    sweepPresence: () => { presenceService.sweep(); },
  };
}

export type MembersAndPresence = ReturnType<typeof wireMembersAndPresence>;
