import type { Client } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../errors.js";
import { ownedClient } from "../auth/scope.js";
import type { CreateClientInput, UpdateClientInput } from "./client.schema.js";
import { buildCampaignCreateData, DEFAULT_CAMPAIGN_NAME } from "../campaigns/defaults.js";

export async function createClient(
  ownerId: string,
  input: CreateClientInput,
): Promise<Client> {
  return prisma.client.create({
    data: {
      ...input,
      ownerId,
      campaigns: { create: buildCampaignCreateData(DEFAULT_CAMPAIGN_NAME, 0) },
    },
  });
}

export async function listClients(ownerId: string): Promise<Client[]> {
  return prisma.client.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" } });
}

/** findFirst rather than findUnique: `where` on findUnique accepts only a
 * unique key, and the owner is not part of one. A foreign id and a missing id
 * both come back null, which is why both answer 404. */
export async function getClient(ownerId: string, id: string): Promise<Client> {
  const client = await prisma.client.findFirst({ where: ownedClient(ownerId, id) });
  if (!client) throw new NotFoundError("Client not found");
  return client;
}

export async function updateClient(
  ownerId: string,
  id: string,
  input: UpdateClientInput,
): Promise<Client> {
  await getClient(ownerId, id);
  return prisma.client.update({ where: { id }, data: input });
}

export async function deleteClient(ownerId: string, id: string): Promise<void> {
  await getClient(ownerId, id);
  await prisma.client.delete({ where: { id } });
}
