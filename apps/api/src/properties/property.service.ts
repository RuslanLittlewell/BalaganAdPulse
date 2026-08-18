import { randomUUID } from "node:crypto";
import type { CampaignProperty, PropertyType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { ownedCampaign, ownedProperty } from "../auth/scope.js";
import {
  assertFormulaIsValid, findDependents, type PropertyRef,
} from "../formula/dependencies.js";
import { fromJson, toJson, type Expression } from "../formula/expression.schema.js";

export interface CreatePropertyInput {
  name: string;
  type: PropertyType;
  formula?: Expression | null;
  position?: number;
}

export interface UpdatePropertyInput {
  name?: string;
  type?: PropertyType;
  formula?: Expression | null;
  position?: number;
}

function toPropertyRef(property: CampaignProperty): PropertyRef {
  return { id: property.id, type: property.type, formula: fromJson(property.formula) };
}

async function getProperty(ownerId: string, id: string): Promise<CampaignProperty> {
  const property = await prisma.campaignProperty.findFirst({
    where: ownedProperty(ownerId, id),
  });
  if (!property) throw new NotFoundError("Property not found");
  return property;
}

async function siblings(campaignId: string): Promise<CampaignProperty[]> {
  return prisma.campaignProperty.findMany({ where: { campaignId }, orderBy: { position: "asc" } });
}

/** Rewrites positions to a dense 0..n-1 sequence, optionally moving one property. */
async function reorder(campaignId: string, movedId?: string, position?: number): Promise<void> {
  const current = await siblings(campaignId);
  let ids = current.map((property) => property.id);
  if (movedId !== undefined && position !== undefined) {
    ids = ids.filter((id) => id !== movedId);
    const target = Math.max(0, Math.min(position, ids.length));
    ids.splice(target, 0, movedId);
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.campaignProperty.update({ where: { id }, data: { position: index } })),
  );
}

async function countValues(propertyId: string): Promise<number> {
  return prisma.campaignPropertyValue.count({ where: { propertyId } });
}

export async function createProperty(
  ownerId: string,
  campaignId: string,
  input: CreatePropertyInput,
): Promise<CampaignProperty> {
  const campaign = await prisma.campaign.findFirst({ where: ownedCampaign(ownerId, campaignId) });
  if (!campaign) throw new NotFoundError("Campaign not found");

  const existing = await siblings(campaignId);
  const id = randomUUID();
  const formula = input.formula ?? null;
  if (formula) {
    if (input.type === "TEXT") throw new ValidationError("A text property cannot have a formula");
    assertFormulaIsValid(id, formula, existing.map(toPropertyRef));
  }

  const position = Math.max(0, Math.min(input.position ?? existing.length, existing.length));
  await prisma.$transaction([
    prisma.campaignProperty.updateMany({
      where: { campaignId, position: { gte: position } },
      data: { position: { increment: 1 } },
    }),
    prisma.campaignProperty.create({
      data: {
        id, campaignId, key: null, name: input.name, type: input.type, position,
        formula: toJson(formula),
      },
    }),
  ]);
  return getProperty(ownerId, id);
}

export async function updateProperty(
  ownerId: string,
  id: string,
  input: UpdatePropertyInput,
): Promise<CampaignProperty> {
  const property = await getProperty(ownerId, id);
  const existing = await siblings(property.campaignId);
  const nextType = input.type ?? property.type;

  if (input.type !== undefined && input.type !== property.type) {
    const crossesTextBoundary = (input.type === "TEXT") !== (property.type === "TEXT");
    if (crossesTextBoundary && (await countValues(id)) > 0) {
      throw new ConflictError("Property has entered values; clear them before changing its type");
    }
  }

  if (input.formula !== undefined && input.formula !== null) {
    if (nextType === "TEXT") throw new ValidationError("A text property cannot have a formula");
    if ((await countValues(id)) > 0) {
      throw new ConflictError("Property has entered values; clear them before adding a formula");
    }
    assertFormulaIsValid(id, input.formula, existing.map(toPropertyRef));
  }
  // `formula: null` turns a computed property back into an entered one — always allowed.

  const nextFormula = input.formula !== undefined ? input.formula : fromJson(property.formula);
  if (nextType === "TEXT" && nextFormula !== null) {
    throw new ValidationError("A text property cannot have a formula");
  }

  const data: { name?: string; type?: PropertyType; formula?: ReturnType<typeof toJson> } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.type !== undefined) data.type = input.type;
  if (input.formula !== undefined) data.formula = toJson(input.formula);
  if (Object.keys(data).length > 0) {
    await prisma.campaignProperty.update({ where: { id }, data });
  }
  if (input.position !== undefined) {
    await reorder(property.campaignId, id, input.position);
  }
  return getProperty(ownerId, id);
}

export async function deleteProperty(ownerId: string, id: string): Promise<void> {
  const property = await getProperty(ownerId, id);
  const existing = await siblings(property.campaignId);
  const dependents = findDependents(id, existing.map(toPropertyRef));
  if (dependents.length > 0) {
    const names = existing
      .filter((sibling) => dependents.some((dependent) => dependent.id === sibling.id))
      .map((sibling) => sibling.name)
      .join(", ");
    throw new ConflictError(`Property is used by the formula of: ${names}`);
  }
  await prisma.campaignProperty.delete({ where: { id } });
  await reorder(property.campaignId);
}
