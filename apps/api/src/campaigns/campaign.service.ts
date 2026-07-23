import type { Campaign } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../errors.js";
import { buildDefaultProperties } from "./defaults.js";
import { fromJson, toJson } from "../formula/expression.schema.js";
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

async function assertClientExists(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new NotFoundError("Client not found");
}

export async function createCampaign(
  clientId: string,
  input: { name: string },
): Promise<Campaign> {
  await assertClientExists(clientId);
  const position = await prisma.campaign.count({ where: { clientId } });
  return prisma.campaign.create({
    data: {
      clientId,
      name: input.name,
      position,
      properties: {
        create: buildDefaultProperties().map((property) => ({
          id: property.id,
          key: property.key,
          name: property.name,
          type: property.type,
          position: property.position,
          formula: toJson(property.formula),
        })),
      },
    },
  });
}

export async function listCampaigns(clientId: string): Promise<Campaign[]> {
  await assertClientExists(clientId);
  return prisma.campaign.findMany({ where: { clientId }, orderBy: { position: "asc" } });
}

export async function getCampaign(id: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new NotFoundError("Campaign not found");
  return campaign;
}

export async function getCampaignTable(id: string): Promise<CampaignPayload> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
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
  id: string,
  input: { name?: string; position?: number },
): Promise<Campaign> {
  const campaign = await getCampaign(id);
  if (input.name !== undefined) {
    await prisma.campaign.update({ where: { id }, data: { name: input.name } });
  }
  if (input.position !== undefined) {
    await normalizePositions(campaign.clientId, id, input.position);
  }
  return getCampaign(id);
}

export async function deleteCampaign(id: string): Promise<void> {
  const campaign = await getCampaign(id);
  await prisma.campaign.delete({ where: { id } });
  await normalizePositions(campaign.clientId);
}
