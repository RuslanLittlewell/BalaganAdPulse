import type { Project } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../errors.js";
import { ownedClient, ownedProject } from "../auth/scope.js";
import { assertAvatarPath, assertAvatarPng } from "../lib/avatar.js";
import { getPng, putPng } from "../lib/storage.js";
import { buildCampaignCreateData, DEFAULT_CAMPAIGN_NAME } from "../campaigns/defaults.js";
import type { CreateProjectInput, UpdateProjectInput } from "./project.schema.js";

async function assertClientOwned(ownerId: string, clientId: string): Promise<void> {
  const client = await prisma.client.findFirst({ where: ownedClient(ownerId, clientId) });
  if (!client) throw new NotFoundError("Client not found");
}

export async function createProject(
  ownerId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const { clientId, ...rest } = input;
  await assertClientOwned(ownerId, clientId);
  const position = await prisma.project.count({ where: { clientId } });
  return prisma.project.create({
    data: {
      ...rest,
      clientId,
      position,
      // A project is only useful with somewhere to type numbers, so it starts
      // with the sheet a client used to start with.
      campaigns: { create: buildCampaignCreateData(DEFAULT_CAMPAIGN_NAME, 0) },
    },
  });
}

/** Every project the caller owns, newest client work first. `clientId` narrows
 * it to one company — what the contact book links through. */
export async function listProjects(ownerId: string, clientId?: string): Promise<Project[]> {
  const projects = await prisma.project.findMany({
    where: { client: { ownerId }, ...(clientId ? { clientId } : {}) },
    orderBy: [{ clientId: "asc" }, { position: "asc" }],
  });
  return Promise.all(projects.map(withAvatar));
}

export async function getProject(ownerId: string, id: string): Promise<Project> {
  const project = await prisma.project.findFirst({ where: ownedProject(ownerId, id) });
  if (!project) throw new NotFoundError("Project not found");
  return project;
}

export async function updateProject(
  ownerId: string,
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  await getProject(ownerId, id);
  if (input.clientId) await assertClientOwned(ownerId, input.clientId);
  return withAvatar(await prisma.project.update({ where: { id }, data: input }));
}

export async function deleteProject(ownerId: string, id: string): Promise<void> {
  await getProject(ownerId, id);
  await prisma.project.delete({ where: { id } });
}

function avatarKey(id: string): string {
  return `projects/${id}/avatar.png`;
}

/**
 * Replaces the stored marker with the logo itself, as a data URL. The bytes
 * travel with the project rather than behind a second endpoint: that endpoint
 * needed the bearer token, so the browser could never put it in an `<img src>`.
 */
async function withAvatar(project: Project): Promise<Project> {
  if (!project.image) return project;
  try {
    const bytes = await getPng(avatarKey(project.id));
    return { ...project, image: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}` };
  } catch {
    // A logo storage cannot serve is a missing logo, not a broken project.
    return { ...project, image: null };
  }
}

export async function saveProjectAvatar(
  ownerId: string,
  id: string,
  png: Buffer,
  avatarPath: string,
): Promise<Project> {
  await getProject(ownerId, id);
  assertAvatarPng(png);
  assertAvatarPath(avatarPath);
  await putPng(avatarKey(id), png);
  // Not a URL: nothing fetches it. It records that a logo exists.
  const saved = await prisma.project.update({
    where: { id },
    data: { image: new Date().toISOString(), avatarPath },
  });
  return withAvatar(saved);
}

/** The same project, with its logo inlined. `getProject` stays the plain
 * ownership check it always was. */
export async function readProject(ownerId: string, id: string): Promise<Project> {
  return withAvatar(await getProject(ownerId, id));
}
