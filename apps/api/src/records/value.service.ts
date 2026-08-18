import { prisma } from "../lib/prisma.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { getCampaignTable } from "../campaigns/campaign.service.js";
import { ownedRecord } from "../auth/scope.js";
import type { ComputedRecord } from "../formula/table.js";

export interface ValueWriteResult {
  record: ComputedRecord;
  totals: Record<string, string | null>;
}

const DECIMAL = /^-?\d+(\.\d+)?$/;

export async function setPropertyValue(
  ownerId: string,
  recordId: string,
  propertyId: string,
  value: string | null,
): Promise<ValueWriteResult> {
  const record = await prisma.campaignRecord.findFirst({ where: ownedRecord(ownerId, recordId) });
  if (!record) throw new NotFoundError("Record not found");

  const property = await prisma.campaignProperty.findUnique({ where: { id: propertyId } });
  if (!property || property.campaignId !== record.campaignId) {
    throw new NotFoundError("Property not found in this campaign");
  }
  if (property.formula !== null) {
    throw new ValidationError("Cannot write to a computed property");
  }

  if (value === null) {
    await prisma.campaignPropertyValue.deleteMany({ where: { recordId, propertyId } });
  } else if (property.type === "TEXT") {
    if (typeof value !== "string") throw new ValidationError("Property expects a text value");
    await prisma.campaignPropertyValue.upsert({
      where: { recordId_propertyId: { recordId, propertyId } },
      create: { recordId, propertyId, textValue: value, numberValue: null },
      update: { textValue: value, numberValue: null },
    });
  } else {
    if (!DECIMAL.test(value)) throw new ValidationError("Property expects a numeric value");
    await prisma.campaignPropertyValue.upsert({
      where: { recordId_propertyId: { recordId, propertyId } },
      create: { recordId, propertyId, numberValue: value, textValue: null },
      update: { numberValue: value, textValue: null },
    });
  }

  const table = await getCampaignTable(ownerId, record.campaignId);
  const computed = table.records.find((candidate) => candidate.id === recordId);
  if (!computed) throw new NotFoundError("Record not found");
  return { record: computed, totals: table.totals };
}
