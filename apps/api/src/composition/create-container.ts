import type { RequestHandler, Router } from "express";
import type { Prisma } from "@prisma/client";
import { requestContext } from "../shared/presentation/request-context.js";
import { prisma } from "../shared/infrastructure/prisma.js";
import { createIdentityUseCases } from "../modules/identity/index.js";
import { PasswordAdapter } from "../modules/identity/infrastructure/password-adapter.js";
import { PrismaRefreshSessionRepository, PrismaUserRepository } from "../modules/identity/infrastructure/prisma-identity-repositories.js";
import { ProfileStorageAdapter } from "../modules/identity/infrastructure/profile-storage-adapter.js";
import { TokenAdapter } from "../modules/identity/infrastructure/token-adapter.js";
import { createAuthentication } from "../modules/identity/presentation/http/authentication.js";
import { createIdentityHttpRouters } from "../modules/identity/presentation/http/identity-http.js";
import {
  PrismaMembershipEnrolment,
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
import { createProjectRouter, createProjectUseCases } from "../modules/projects/index.js";
import { PrismaProjectRepository } from "../modules/projects/infrastructure/prisma-project-repository.js";
import { S3ProjectPictureStorage } from "../modules/projects/infrastructure/project-picture-storage.js";
import {
  DEFAULT_CAMPAIGN_NAME,
  createCampaignHttpRouters,
  createCampaignUseCases,
} from "../modules/campaigns/index.js";
import { createRecordHttpRouters, createRecordUseCases } from "../modules/records/index.js";
import {
  createTaskImageRouter,
  createTaskImageUseCases,
  createTaskRouter,
  createTaskUseCases,
} from "../modules/tasks/index.js";
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
import {
  PrismaRecordRepository,
  PrismaValueRepository,
} from "../modules/records/infrastructure/prisma-record-repositories.js";
import {
  PrismaAuditContext,
  PrismaCampaignRepository,
  PrismaProjectReach,
  PrismaPropertyRepository,
} from "../modules/campaigns/infrastructure/prisma-campaign-repositories.js";
import { createInviteRouter, createInviteUseCases } from "../modules/invites/index.js";
import { PrismaInviteRepository } from "../modules/invites/infrastructure/prisma-invite-repository.js";
import { RandomIdGenerator } from "../shared/infrastructure/id-generator.js";
import { SystemClock } from "../shared/infrastructure/clock.js";
import { PrismaUnitOfWork } from "../shared/infrastructure/prisma-unit-of-work.js";

export interface ApiContainer {
  readonly authRouter: Router;
  readonly authentication: RequestHandler;
  readonly actorResolution: RequestHandler;
  readonly requestContext: RequestHandler;
  readonly sessionRouter: Router;
  readonly userRouter: Router;
  readonly inviteRouter: Router;
  readonly memberRouter: Router;
  readonly auditRouter: Router;
  readonly projectCampaignRouter: Router;
  readonly projectRouter: Router;
  readonly clientRouter: Router;
  readonly campaignPropertyRouter: Router;
  readonly campaignRecordRouter: Router;
  readonly campaignRouter: Router;
  readonly propertyRouter: Router;
  readonly recordRouter: Router;
  readonly taskRouter: Router;
  readonly taskImageRouter: Router;
}

/** Compatibility composition while legacy vertical slices are migrated. */
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
  const clients = createClientUseCases({
    clients: new PrismaClientRepository(prisma, unitOfWork),
    pictures: new S3ClientPictureStorage(),
    audit,
    ids,
    unitOfWork,
  });
  const invites = createInviteUseCases({
    invites: new PrismaInviteRepository(prisma, unitOfWork),
    memberships: new PrismaMembershipEnrolment(unitOfWork),
    clock,
    ids,
    unitOfWork,
  });
  const identity = createIdentityUseCases({
    users: new PrismaUserRepository(prisma, unitOfWork),
    // Identity owns the port; the invitations module implements it.
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
    // The session payload wants the stored picture marker, not the data URL the
    // profile endpoint builds, so it reads the identity record directly.
    users: {
      findById: async (id) => {
        const user = await users.findById(id);
        return user && { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    },
    clients: { reachableClientIds: clients.reachableIds },
    directory: new PrismaMemberDirectory(prisma, unitOfWork),
    access: new PrismaAccessRepository(prisma, unitOfWork),
    unitOfWork,
  });
  const campaignRepository = new PrismaCampaignRepository(prisma, unitOfWork, ids);
  const projectReach = new PrismaProjectReach(prisma);
  const auditContextLookup = new PrismaAuditContext(prisma);
  const campaigns = createCampaignUseCases({
    campaigns: campaignRepository,
    properties: new PrismaPropertyRepository(prisma, unitOfWork),
    projects: projectReach,
    auditContext: auditContextLookup,
    audit,
    ids,
    unitOfWork,
  });
  const campaignHttp = createCampaignHttpRouters(campaigns);
  const records = createRecordUseCases({
    records: new PrismaRecordRepository(prisma, unitOfWork),
    values: new PrismaValueRepository(prisma, unitOfWork),
    campaigns: {
      contextFor: async (actor, campaignId) => {
        const campaign = await campaignRepository.findReachable(actor, campaignId);
        if (!campaign) return null;
        const context = await auditContextLookup.forCampaign(campaignId);
        return { clientId: context.clientId, projectId: context.projectId };
      },
      readTable: async (actor, campaignId) => {
        const table = await campaigns.readTable(actor, campaignId).catch(() => null);
        return table && { records: table.records, totals: table.totals };
      },
    },
    audit,
    ids,
    unitOfWork,
  });
  const recordHttp = createRecordHttpRouters(records);
  const taskDependencies = {
    tasks: new PrismaTaskRepository(prisma, unitOfWork),
    images: new PrismaTaskImageRepository(prisma, unitOfWork),
    imageStorage: new S3TaskImageStorage(),
    projects: new PrismaTaskProjectReach(prisma),
    members: new PrismaTaskMemberReach(prisma),
    audit,
    ids,
    unitOfWork,
  };
  const tasks = createTaskUseCases(taskDependencies);
  const taskImages = createTaskImageUseCases(taskDependencies);
  const projects = createProjectUseCases({
    projects: new PrismaProjectRepository(prisma, unitOfWork),
    clients: {
      isReachable: async (actor, clientId) =>
        (await clients.reachableIds(actor)).includes(clientId),
    },
    campaigns: {
      seedDefault: async (context, projectId) => {
        await campaignRepository.create(context, {
          id: ids.generate(), projectId, name: DEFAULT_CAMPAIGN_NAME, position: 0,
        });
      },
    },
    pictures: new S3ProjectPictureStorage(),
    audit,
    ids,
    unitOfWork,
  });
  return {
    authRouter: identityHttp.authRouter,
    authentication: createAuthentication(identity),
    actorResolution: createActorResolution(members),
    requestContext,
    sessionRouter: createSessionRouter(members),
    userRouter: identityHttp.userRouter,
    inviteRouter: createInviteRouter(invites),
    memberRouter: createMemberRouter(members),
    auditRouter: createAuditRouter(auditReader),
    projectCampaignRouter: campaignHttp.projectCampaignRouter,
    projectRouter: createProjectRouter(projects),
    clientRouter: createClientRouter(clients),
    campaignPropertyRouter: campaignHttp.campaignPropertyRouter,
    campaignRecordRouter: recordHttp.campaignRecordRouter,
    campaignRouter: campaignHttp.campaignRouter,
    propertyRouter: campaignHttp.propertyRouter,
    recordRouter: recordHttp.recordRouter,
    taskRouter: createTaskRouter(tasks),
    taskImageRouter: createTaskImageRouter(taskImages, taskImageUpload.single("image")),
  };
}
