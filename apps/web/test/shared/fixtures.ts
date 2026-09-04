import type { Client } from "@/entities/client/index.js";
import type { Task } from "@/entities/task/index.js";
import type { Project } from "@/entities/project/index.js";

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
    niche: null,
    monthlyBudget: null,
    budgetCurrency: "BYN",
    priority: "NEW",
    image: null,
    avatarPath: null,
    position: 0,
    createdAt: "",
    updatedAt: "",
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
    assigneeId: null,
    createdById: "member-1",
    campaignId: null,
    visibleToClient: false,
    position: 0,
    imageIds: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}
