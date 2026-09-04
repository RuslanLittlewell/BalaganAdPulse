import { Router, type RequestHandler } from "express";
import type { Prisma } from "@prisma/client";
import { config } from "#shared/infrastructure/config.js";
import { requestContext } from "#shared/presentation/request-context.js";
import { apiDocument, createDocumentationRouter } from "./openapi.js";
import { prisma } from "#shared/infrastructure/prisma.js";
import { createIdentityUseCases } from "../modules/identity/index.js";
import { PasswordAdapter } from "../modules/identity/infrastructure/password-adapter.js";
import { PrismaRefreshSessionRepository, PrismaUserRepository } from "../modules/identity/infrastructure/prisma-identity-repositories.js";
import { ProfileStorageAdapter } from "../modules/identity/infrastructure/profile-storage-adapter.js";
import { TokenAdapter } from "../modules/identity/infrastructure/token-adapter.js";
import { createAuthentication } from "../modules/identity/presentation/http/authentication.js";
import type { SessionPrincipal } from "../modules/identity/index.js";
import { createIdentityHttpRouters } from "../modules/identity/presentation/http/identity-http.js";
import {
  PrismaMembershipEnrolment,
  PrismaInvitationProjectAccess,
  createActorResolution,
  createMemberRouter,
  createMemberUseCases,
  createSessionRouter,
} from "../modules/members/index.js";
import { PrismaAccessRepository } from "../modules/members/infrastructure/prisma-access-repository.js";
import { PrismaMemberDirectory } from "../modules/members/infrastructure/prisma-member-directory.js";
import { PrismaMembershipDirectory } from "../modules/members/infrastructure/prisma-membership-directory.js";
import { PrismaOrganizationDirectory } from "../modules/members/infrastructure/prisma-organization-directory.js";
import { createClientRouter, createClientUseCases } from "../modules/clients/index.js";
import { S3ClientPictureStorage } from "../modules/clients/infrastructure/client-picture-storage.js";
import { PrismaClientRepository } from "../modules/clients/infrastructure/prisma-client-repository.js";
import { createAuditReader, createAuditRouter, createAuditWriter } from "../modules/audit/index.js";
import {
  PrismaActorSnapshots,
  PrismaAuditReach,
  PrismaAuditRepository,
} from "../modules/audit/infrastructure/prisma-audit-repository.js";
import { AmbientRequestMetadata } from "../modules/audit/infrastructure/request-metadata.js";
import { CURRENCIES, createProjectRouter, createProjectUseCases } from "../modules/projects/index.js";
import type { Currency } from "../modules/projects/index.js";
import { PrismaProjectRepository } from "../modules/projects/infrastructure/prisma-project-repository.js";
import { S3ProjectPictureStorage } from "../modules/projects/infrastructure/project-picture-storage.js";
import { createCampaignHttpRouters, createCampaignUseCases } from "../modules/campaigns/index.js";
import {
  createTaskImageRouter,
  createTaskImageUseCases,
  createTaskRouter,
  createTaskUseCases,
} from "../modules/tasks/index.js";
import type { TaskEvent } from "../modules/tasks/index.js";
import {
  PrismaTaskImageRepository,
  S3TaskImageStorage,
} from "../modules/tasks/infrastructure/prisma-task-image-repository.js";
import { taskImageUpload } from "../modules/tasks/presentation/http/task-image-upload.js";
import {
  PrismaTaskMemberReach,
  PrismaTaskProjectReach,
  PrismaTaskRepository,
} from "../modules/tasks/infrastructure/prisma-task-repository.js";
import { S3MemberAvatarStorage } from "../modules/members/infrastructure/member-avatar-storage.js";
import { createConnectionRegistry, createTaskEventDelivery } from "../modules/realtime/index.js";
import type { ConnectionRegistry } from "../modules/realtime/index.js";
import {
  PrismaAdRepository,
  PrismaAdSetRepository,
  PrismaCampaignInProject,
  PrismaCampaignRepository,
  PrismaProjectReach,
} from "../modules/campaigns/infrastructure/prisma-campaign-repositories.js";
import { PrismaMetricRepository } from "../modules/campaigns/infrastructure/prisma-metric-repository.js";
import {
  CryptoInvitationCodeGenerator,
  createInviteRouter,
  createRegistrationResolverRouter,
  createInviteUseCases,
} from "../modules/invites/index.js";
import { PrismaInviteRepository } from "../modules/invites/infrastructure/prisma-invite-repository.js";
import { PrismaInvitationProjectReach } from "../modules/invites/infrastructure/prisma-invitation-project-reach.js";
import { RandomIdGenerator } from "#shared/infrastructure/id-generator.js";
import { SystemClock } from "#shared/infrastructure/clock.js";
import { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";

export interface ApiContainer {
  readonly documentationRouter: Router;
  readonly authRouter: Router;
  readonly authentication: RequestHandler;
  readonly actorResolution: RequestHandler;
  readonly requestContext: RequestHandler;
  readonly sessionRouter: Router;
  readonly userRouter: Router;
  readonly inviteRouter: Router;
  readonly registrationResolverRouter: Router;
  readonly memberRouter: Router;
  readonly auditRouter: Router;
  readonly projectMetricRouter: Router;
  readonly projectRouter: Router;
  readonly clientRouter: Router;
  readonly campaignRouter: Router;
  readonly adSetRouter: Router;
  readonly summaryRouter: Router;
  readonly taskRouter: Router;
  readonly taskImageRouter: Router;
  readonly connections: ConnectionRegistry;
  readonly authenticate: (accessToken: string) => Promise<SessionPrincipal>;
}

const isCurrency = (value: string | undefined): value is Currency =>
  value !== undefined && (CURRENCIES as readonly string[]).includes(value);

export function createContainer(): ApiContainer {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  const clock = new SystemClock();
  const ids = new RandomIdGenerator();
  const auditDependencies = {
    events: new PrismaAuditRepository(prisma, unitOfWork),
    reach: new PrismaAuditReach(prisma),
    metadata: new AmbientRequestMetadata(),
    snapshots: new PrismaActorSnapshots(unitOfWork),
  };
  const audit = createAuditWriter(auditDependencies);
  const auditReader = createAuditReader(auditDependencies);
  const clientRepository = new PrismaClientRepository(prisma, unitOfWork);
  const projectRepository = new PrismaProjectRepository(prisma, unitOfWork);
  const clients = createClientUseCases({
    clients: clientRepository,
    pictures: new S3ClientPictureStorage(),
    audit,
    ids,
    unitOfWork,
  });
  const invites = createInviteUseCases({
    invites: new PrismaInviteRepository(prisma, unitOfWork),
    memberships: new PrismaMembershipEnrolment(unitOfWork),
    projects: new PrismaInvitationProjectReach(prisma),
    clients: {
      isReachable: async (actor, clientId) =>
        (await clients.reachableIds(actor)).includes(clientId),
    },
    clientProjects: {
      projectIdsOf: async (clientId) => {
        const rows = await prisma.project.findMany({ where: { clientId }, select: { id: true } });
        return rows.map((project) => project.id);
      },
    },
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
        const { clientId, budgetCurrency, ...details } = input;
        const created = await projectRepository.create(context, {
          ...details,
          ...(isCurrency(budgetCurrency) ? { budgetCurrency } : {}),
          clientId,
          id: ids.generate(),
          position: await projectRepository.countForClient(clientId),
        });
        return created.id;
      },
    },
    clock,
    ids,
    codes: new CryptoInvitationCodeGenerator(),
    unitOfWork,
  });
  const identity = createIdentityUseCases({
    users: new PrismaUserRepository(prisma, unitOfWork),
    invitations: { redeem: invites.redeem },
    passwords: new PasswordAdapter(),
    tokens: new TokenAdapter(),
    sessions: new PrismaRefreshSessionRepository(prisma, unitOfWork),
    profiles: new ProfileStorageAdapter(),
    clock,
    unitOfWork,
  });
  const identityHttp = createIdentityHttpRouters(identity);
  const users = new PrismaUserRepository(prisma, unitOfWork);
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
    directory: new PrismaMemberDirectory(prisma, unitOfWork),
    access: new PrismaAccessRepository(prisma, unitOfWork),
    avatars: new S3MemberAvatarStorage(),
    unitOfWork,
  });
  const campaigns = createCampaignUseCases({
    campaigns: new PrismaCampaignRepository(prisma),
    adSets: new PrismaAdSetRepository(prisma),
    ads: new PrismaAdRepository(prisma),
    projects: new PrismaProjectReach(prisma),
    metrics: new PrismaMetricRepository(prisma),
  });
  const campaignHttp = createCampaignHttpRouters(campaigns);
  const taskProjectReach = new PrismaTaskProjectReach(prisma);
  const connections = createConnectionRegistry();
  const taskEventDelivery = createTaskEventDelivery({
    registry: connections,
    members,
    projects: taskProjectReach,
  });
  const taskDependencies = {
    tasks: new PrismaTaskRepository(prisma, unitOfWork),
    images: new PrismaTaskImageRepository(prisma, unitOfWork),
    imageStorage: new S3TaskImageStorage(),
    projects: taskProjectReach,
    campaigns: new PrismaCampaignInProject(prisma),
    members: new PrismaTaskMemberReach(prisma),
    audit,
    events: {
      publish: (event: TaskEvent) => {
        void taskEventDelivery.deliver(event).catch((error: unknown) => {
          console.error("Failed to deliver task event:", error);
        });
      },
    },
    ids,
    unitOfWork,
  };
  const tasks = createTaskUseCases(taskDependencies);
  const taskImages = createTaskImageUseCases(taskDependencies);
  const projects = createProjectUseCases({
    projects: projectRepository,
    clients: {
      isReachable: async (actor, clientId) =>
        (await clients.reachableIds(actor)).includes(clientId),
    },
    pictures: new S3ProjectPictureStorage(),
    audit,
    ids,
    unitOfWork,
  });
  return {
    documentationRouter: config.documentation ? createDocumentationRouter(apiDocument()) : Router(),
    authRouter: identityHttp.authRouter,
    authentication: createAuthentication(identity),
    actorResolution: createActorResolution(members),
    requestContext,
    sessionRouter: createSessionRouter(members),
    userRouter: identityHttp.userRouter,
    inviteRouter: createInviteRouter(invites),
    registrationResolverRouter: createRegistrationResolverRouter(invites),
    memberRouter: createMemberRouter(members),
    auditRouter: createAuditRouter(auditReader),
    projectMetricRouter: campaignHttp.projectMetricRouter,
    projectRouter: createProjectRouter(projects),
    clientRouter: createClientRouter(clients),
    campaignRouter: campaignHttp.campaignRouter,
    adSetRouter: campaignHttp.adSetRouter,
    summaryRouter: campaignHttp.summaryRouter,
    taskRouter: createTaskRouter(tasks),
    taskImageRouter: createTaskImageRouter(taskImages, taskImageUpload.single("image")),
    connections,
    authenticate: (token: string) => identity.authenticate(token),
  };
}
