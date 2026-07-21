import type { Client } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../errors.js";
import type { CreateClientInput, UpdateClientInput } from "./client.schema.js";

export async function createClient(input: CreateClientInput): Promise<Client> {
  return prisma.client.create({ data: input });
}

export async function listClients(): Promise<Client[]> {
  return prisma.client.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getClient(id: string): Promise<Client> {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new NotFoundError("Client not found");
  return client;
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  await getClient(id);
  return prisma.client.update({ where: { id }, data: input });
}

export async function deleteClient(id: string): Promise<void> {
  await getClient(id);
  await prisma.client.delete({ where: { id } });
}
