import type { Client } from "@/entities/client/index.js";
import type { Project } from "@/entities/project/index.js";

/** A complete client, so a new field on the type never breaks every test that
 * happens to need one. Override only what the test is about. */
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

/** A complete project, for the same reason as `aClient`. */
export function aProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    clientId: "1",
    name: "Летний запуск",
    niche: null,
    monthlyBudget: null,
    priority: "NEW",
    image: null,
    avatarPath: null,
    position: 0,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}
