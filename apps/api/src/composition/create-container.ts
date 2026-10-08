import { Router, type RequestHandler } from "express";
import { config } from "#shared/infrastructure/config.js";
import { requestContext } from "#shared/presentation/request-context.js";
import { createAuditRouter } from "#modules/audit/index.js";
import type { SessionPrincipal } from "#modules/identity/index.js";
import type { createImportWorker } from "#modules/integrations/application/import-worker.js";
import type { createLeadPollWorker } from "#modules/integrations/application/lead-poll-worker.js";
import type { PresenceRegistry } from "#modules/presence/index.js";
import type { Connection, ConnectionRegistry } from "#modules/realtime/index.js";
import { apiDocument, createDocumentationRouter } from "./openapi.js";
import { wireCampaignsAndIntegrations } from "./wiring/campaigns-integrations.js";
import { wireClientsAndProjects } from "./wiring/clients-projects.js";
import { wireIdentity } from "./wiring/identity.js";
import { wireInvites } from "./wiring/invites.js";
import { createKernel } from "./wiring/kernel.js";
import { wireLeads } from "./wiring/leads.js";
import { wireMembersAndPresence } from "./wiring/members-presence.js";
import { wireReportsAndKpi } from "./wiring/reports-kpi.js";
import { wireTasks } from "./wiring/tasks.js";

export interface ApiContainer {
  readonly integrationRouter: Router;
  readonly importWorker: ReturnType<typeof createImportWorker>;
  readonly leadPollWorker: ReturnType<typeof createLeadPollWorker>;
  readonly kpiRouter: Router;
  readonly reportRouter: Router;
  readonly reportIndexRouter: Router;
  readonly leadRouter: Router;
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
  readonly projectLayoutRouter: Router;
  readonly adPreviewRouter: Router;
  readonly projectGroupRouter: Router;
  readonly clientRouter: Router;
  readonly campaignRouter: Router;
  readonly adSetRouter: Router;
  readonly adCreativeRouter: Router;
  readonly summaryRouter: Router;
  readonly taskRouter: Router;
  readonly taskImageRouter: Router;
  readonly connections: ConnectionRegistry;
  readonly presence: PresenceRegistry;
  readonly presenceTouch: RequestHandler;
  readonly greetPresence: (connection: Connection) => void;
  readonly sweepPresence: () => void;
  readonly authenticate: (accessToken: string) => Promise<SessionPrincipal>;
}

export function createContainer(): ApiContainer {
  const kernel = createKernel();
  const catalog = wireClientsAndProjects(kernel);
  const invites = wireInvites(kernel, catalog);
  const people = wireMembersAndPresence(kernel, catalog);
  const identity = wireIdentity(kernel, { redeem: invites.redeem, signedOut: people.leave });
  const leads = wireLeads(kernel, people);
  const advertising = wireCampaignsAndIntegrations(kernel, {
    projectRepository: catalog.projectRepository,
    leadIntake: leads.leadIntake,
  });
  const tasks = wireTasks(kernel, people);
  const reporting = wireReportsAndKpi(kernel, {
    projectRepository: catalog.projectRepository,
    campaignRepository: advertising.campaignRepository,
  });

  return {
    documentationRouter: config.documentation ? createDocumentationRouter(apiDocument()) : Router(),
    requestContext,
    auditRouter: createAuditRouter(kernel.auditReader),
    connections: kernel.connections,

    authRouter: identity.authRouter,
    userRouter: identity.userRouter,
    authentication: identity.authentication,
    authenticate: identity.authenticate,

    actorResolution: people.actorResolution,
    sessionRouter: people.sessionRouter,
    memberRouter: people.memberRouter,
    presence: people.presence,
    presenceTouch: people.presenceTouch,
    greetPresence: people.greetPresence,
    sweepPresence: people.sweepPresence,

    inviteRouter: invites.inviteRouter,
    registrationResolverRouter: invites.registrationResolverRouter,

    clientRouter: catalog.clientRouter,
    projectRouter: catalog.projectRouter,
    projectLayoutRouter: catalog.projectLayoutRouter,
    projectGroupRouter: catalog.projectGroupRouter,

    campaignRouter: advertising.campaignRouter,
    adSetRouter: advertising.adSetRouter,
    adCreativeRouter: advertising.adCreativeRouter,
    projectMetricRouter: advertising.projectMetricRouter,
    summaryRouter: advertising.summaryRouter,
    integrationRouter: advertising.integrationRouter,
    adPreviewRouter: advertising.adPreviewRouter,
    importWorker: advertising.importWorker,
    leadPollWorker: advertising.leadPollWorker,

    taskRouter: tasks.taskRouter,
    taskImageRouter: tasks.taskImageRouter,

    leadRouter: leads.leadRouter,

    reportRouter: reporting.reportRouter,
    reportIndexRouter: reporting.reportIndexRouter,
    kpiRouter: reporting.kpiRouter,
  };
}
