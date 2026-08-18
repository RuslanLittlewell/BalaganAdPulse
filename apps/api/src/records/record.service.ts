import type { CampaignRecord } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ConflictError, NotFoundError } from "../errors.js";
import { formatDate } from "../lib/date.js";
import { ownedCampaign, ownedRecord } from "../auth/scope.js";

/** A day is stored as a pure date; UTC midnight keeps it stable across timezones. */
export function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export interface SerializedRecord {
  id: string;
  campaignId: string;
  date: string;
}

/** Shapes a record for the HTTP response, formatting `date` the same bare
 * `YYYY-MM-DD` way the campaign table computation does. */
export function serializeRecord(record: CampaignRecord): SerializedRecord {
  return { id: record.id, campaignId: record.campaignId, date: formatDate(record.date) };
}

async function getRecord(ownerId: string, id: string): Promise<CampaignRecord> {
  const record = await prisma.campaignRecord.findFirst({ where: ownedRecord(ownerId, id) });
  if (!record) throw new NotFoundError("Record not found");
  return record;
}

async function assertDateIsFree(campaignId: string, date: Date, exceptRecordId?: string) {
  const existing = await prisma.campaignRecord.findUnique({
    where: { campaignId_date: { campaignId, date } },
  });
  if (existing && existing.id !== exceptRecordId) {
    throw new ConflictError(`The campaign already has a record for ${formatDate(date)}`);
  }
}

export async function createRecord(
  ownerId: string,
  campaignId: string,
  input: { date: string },
): Promise<CampaignRecord> {
  const campaign = await prisma.campaign.findFirst({ where: ownedCampaign(ownerId, campaignId) });
  if (!campaign) throw new NotFoundError("Campaign not found");
  const date = parseDate(input.date);
  await assertDateIsFree(campaignId, date);
  return prisma.campaignRecord.create({ data: { campaignId, date } });
}

export async function updateRecord(
  ownerId: string,
  id: string,
  input: { date: string },
): Promise<CampaignRecord> {
  const record = await getRecord(ownerId, id);
  const date = parseDate(input.date);
  await assertDateIsFree(record.campaignId, date, id);
  return prisma.campaignRecord.update({ where: { id }, data: { date } });
}

export async function deleteRecord(ownerId: string, id: string): Promise<void> {
  await getRecord(ownerId, id);
  await prisma.campaignRecord.delete({ where: { id } });
}
