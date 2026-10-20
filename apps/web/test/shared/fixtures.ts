import type { Client } from "@/entities/client/index.js";
import type { Task } from "@/entities/task/index.js";
import type { Lead } from "@/entities/lead/index.js";
import type { Project } from "@/entities/project/index.js";
import type { PlatformOrganization } from "@/entities/platform-organization/index.js";
import type { AuthSession } from "@/features/auth/api.js";

export function aClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "1",
    name: "Acme",
    fullName: null,
    organization: null,
    unp: null,
    phone: null,
    telegram: null,
    email: null,
    website: null,
    image: null,
    avatarPath: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

export function aProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    clientId: "1",
    name: "Летний запуск",
    budgetCurrency: "BYN",
    image: null,
    avatarPath: null,
    position: 0,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

export function aLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    orgId: "org-1",
    name: "Анна",
    company: null,
    phone: null,
    email: null,
    website: null,
    source: null,
    notes: null,
    amount: null,
    service: null,
    telegram: null,
    messenger: null,
    tags: [],
    projectId: "project-1",
    campaignId: null,
    assigneeId: null,
    adId: null,
    origin: "MANUAL",
    ad: null,
    project: { id: "project-1", clientId: "client-1", name: "Летний запуск" },
    assignee: null,
    metaSource: null,
    stage: "NEW",
    position: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

export function aTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    projectId: "project-1",
    orgId: "org-1",
    title: "Написать бриф",
    description: null,
    column: "IDEA",
    priority: "MEDIUM",
    createdById: "member-1",
    participantIds: [],
    visibleToClient: false,
    position: 0,
    dueDate: null,
    dueTime: null,
    endTime: null,
    repeatEvery: "NONE",
    isCall: false,
    checklist: [],
    imageIds: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

export function aSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
    platformAdmin: false,
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse", status: "ACTIVE" },
    role: "ADMIN",
    clientIds: [],
    modules: ["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"],
    ...overrides,
  };
}

export function aPlatformAdminSession(): AuthSession {
  return aSession({
    user: { id: "platform-1", name: "Платформа", email: "global-admin@balagan.pro", image: null },
    platformAdmin: true,
    organization: null,
    role: null,
    modules: [],
  });
}

export function aPlatformOrganization(overrides: Partial<PlatformOrganization> = {}): PlatformOrganization {
  return {
    id: "org-1",
    name: "Balagan",
    slug: "balagan",
    status: "ACTIVE",
    modules: ["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"],
    activeMembers: 12,
    createdAt: "2026-08-31T12:00:00.000Z",
    firstAdmin: null,
    ...overrides,
  };
}
