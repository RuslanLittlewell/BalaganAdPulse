import type { Campaign } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../errors.js";
import { ownedCampaign, ownedClient } from "../auth/scope.js";
import { buildCampaignCreateData } from "./defaults.js";
import { fromJson } from "../formula/expression.schema.js";
import {
  computeTable, type ComputedRecord, type TableProperty, type TableRecord,
} from "../formula/table.js";

export interface CampaignPayload {
  id: string;
  clientId: string;
  name: string;
  position: number;
  properties: TableProperty[];
  records: ComputedRecord[];
  totals: Record<string, string | null>;
}

async function assertClientOwned(ownerId: string, clientId: string): Promise<void> {
  const client = await prisma.client.findFirst({ where: ownedClient(ownerId, clientId) });
  if (!client) throw new NotFoundError("Client not found");
}

export async function createCampaign(
  ownerId: string,
  clientId: string,
  input: { name: string },
): Promise<Campaign> {
  await assertClientOwned(ownerId, clientId);
  const position = await prisma.campaign.count({ where: { clientId } });
  return prisma.campaign.create({
    data: { clientId, ...buildCampaignCreateData(input.name, position) },
  });
}

export async function listCampaigns(ownerId: string, clientId: string): Promise<Campaign[]> {
  await assertClientOwned(ownerId, clientId);
  return prisma.campaign.findMany({ where: { clientId }, orderBy: { position: "asc" } });
}

export async function getCampaign(ownerId: string, id: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findFirst({ where: ownedCampaign(ownerId, id) });
  if (!campaign) throw new NotFoundError("Campaign not found");
  return campaign;
}

export async function getCampaignTable(ownerId: string, id: string): Promise<CampaignPayload> {
  const campaign = await prisma.campaign.findFirst({
    where: ownedCampaign(ownerId, id),
    include: {
      properties: { orderBy: { position: "asc" } },
      records: { orderBy: { date: "asc" }, include: { values: true } },
    },
  });
  if (!campaign) throw new NotFoundError("Campaign not found");

  const properties: TableProperty[] = campaign.properties.map((property) => ({
    id: property.id,
    key: property.key,
    name: property.name,
    type: property.type,
    position: property.position,
    formula: fromJson(property.formula),
  }));
  const tableRecords: TableRecord[] = campaign.records.map((record) => ({
    id: record.id,
    date: record.date,
    storedValues: record.values,
  }));
  const { records, totals } = computeTable(properties, tableRecords);

  return {
    id: campaign.id,
    clientId: campaign.clientId,
    name: campaign.name,
    position: campaign.position,
    properties,
    records,
    totals,
  };
}

/** Rewrites positions to a dense 0..n-1 sequence, optionally moving one campaign. */
export async function normalizePositions(
  clientId: string,
  movedId?: string,
  position?: number,
): Promise<void> {
  const siblings = await prisma.campaign.findMany({
    where: { clientId }, orderBy: { position: "asc" }, select: { id: true },
  });
  let ids = siblings.map((sibling) => sibling.id);
  if (movedId !== undefined && position !== undefined) {
    ids = ids.filter((id) => id !== movedId);
    const target = Math.max(0, Math.min(position, ids.length));
    ids.splice(target, 0, movedId);
  }
  await prisma.$transaction(
    ids.map((id, index) => prisma.campaign.update({ where: { id }, data: { position: index } })),
  );
}

export async function updateCampaign(
  ownerId: string,
  id: string,
  input: { name?: string; position?: number },
): Promise<Campaign> {
  const campaign = await getCampaign(ownerId, id);
  if (input.name !== undefined) {
    await prisma.campaign.update({ where: { id }, data: { name: input.name } });
  }
  if (input.position !== undefined) {
    await normalizePositions(campaign.clientId, id, input.position);
  }
  return getCampaign(ownerId, id);
}

export async function deleteCampaign(ownerId: string, id: string): Promise<void> {
  const campaign = await getCampaign(ownerId, id);
  await prisma.campaign.delete({ where: { id } });
  await normalizePositions(campaign.clientId);
}
