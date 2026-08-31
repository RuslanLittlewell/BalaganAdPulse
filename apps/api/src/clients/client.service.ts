import type { Client } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../errors.js";
import { assertAvatarPath, assertAvatarPng } from "../lib/avatar.js";
import { getPng, putPng } from "../lib/storage.js";
import { ownedClient } from "../auth/scope.js";
import type { CreateClientInput, UpdateClientInput } from "./client.schema.js";

export async function createClient(
  ownerId: string,
  input: CreateClientInput,
): Promise<Client> {
  // No sheet is seeded here any more: sheets belong to a project, and a client
  // may sit in the contact book long before any work starts.
  return prisma.client.create({ data: { ...input, ownerId } });
}

export async function listClients(ownerId: string): Promise<Client[]> {
  const clients = await prisma.client.findMany({
    where: { ownerId }, orderBy: { createdAt: "desc" },
  });
  return Promise.all(clients.map(withAvatar));
}

/** findFirst rather than findUnique: `where` on findUnique accepts only a
 * unique key, and the owner is not part of one. A foreign id and a missing id
 * both come back null, which is why both answer 404. */
export async function getClient(ownerId: string, id: string): Promise<Client> {
  const client = await prisma.client.findFirst({ where: ownedClient(ownerId, id) });
  if (!client) throw new NotFoundError("Client not found");
  return client;
}

/** The same client, with its picture inlined. Used by everything that answers
 * a request; the plain `getClient` stays the ownership check it always was. */
export async function readClient(ownerId: string, id: string): Promise<Client> {
  return withAvatar(await getClient(ownerId, id));
}

export async function updateClient(
  ownerId: string,
  id: string,
  input: UpdateClientInput,
): Promise<Client> {
  await getClient(ownerId, id);
  return withAvatar(await prisma.client.update({ where: { id }, data: input }));
}

export async function deleteClient(ownerId: string, id: string): Promise<void> {
  await getClient(ownerId, id);
  await prisma.client.delete({ where: { id } });
}

/** Where a client's picture lives. One object per client, overwritten in place. */
function avatarKey(id: string): string {
  return `clients/${id}/avatar.png`;
}

/**
 * Replaces the stored marker with the picture itself, as a data URL.
 *
 * The bytes travel with the client rather than behind a second endpoint: that
 * endpoint needed the bearer token, so the browser could never put it in an
 * `<img src>` and the contact book had to fetch every picture by hand.
 */
async function withAvatar(client: Client): Promise<Client> {
  if (!client.image) return client;
  try {
    const bytes = await getPng(avatarKey(client.id));
    return { ...client, image: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}` };
  } catch {
    // A picture storage cannot serve is a missing picture, not a broken client.
    return { ...client, image: null };
  }
}

export async function saveClientAvatar(
  ownerId: string,
  id: string,
  png: Buffer,
  avatarPath: string,
): Promise<Client> {
  // Ownership first: a foreign id must not even reach storage.
  await getClient(ownerId, id);
  assertAvatarPng(png);
  assertAvatarPath(avatarPath);
  await putPng(avatarKey(id), png);
  // Not a URL: nothing fetches it. It records that a picture exists.
  const saved = await prisma.client.update({
    where: { id },
    data: { image: new Date().toISOString(), avatarPath },
  });
  return withAvatar(saved);
}
