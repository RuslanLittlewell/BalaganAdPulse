import { Decimal } from "decimal.js";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ActorContext, IdGenerator, TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import { formatDate } from "../../../shared/infrastructure/date.js";
import { buildDefaultProperties, DEFAULT_CAMPAIGN_NAME } from "../domain/defaults.js";
import type { Expression } from "../domain/expression.js";
import type { PropertyType } from "../domain/property.js";
import type {
  AuditContextLookup,
  CampaignRecord,
  CampaignRepository,
  ProjectReach,
  PropertyRecord,
  PropertyRepository,
  TableData,
} from "../application/ports.js";

/** Prisma types JSON structurally; an Expression is JSON-safe by construction,
 * so the cast is the documented way to hand it over without widening the type. */
function toJson(formula: Expression | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return formula === null ? Prisma.DbNull : (formula as unknown as Prisma.InputJsonValue);
}

function fromJson(value: Prisma.JsonValue | null): Expression | null {
  return value === null ? null : (value as unknown as Expression);
}

function propertyToDomain(row: {
  id: string; campaignId: string; key: string | null; name: string;
  type: PropertyType; position: number; formula: Prisma.JsonValue | null;
}): PropertyRecord {
  return {
    id: row.id, campaignId: row.campaignId, key: row.key, name: row.name,
    type: row.type, position: row.position, formula: fromJson(row.formula),
  };
}

/** Which campaigns an actor can reach, derived from the project filter. */
function reachFilter(actor: ActorContext): Prisma.CampaignWhereInput {
  if (actor.role === "ADMIN") return { project: { client: { orgId: actor.orgId } } };
  return {
    project: {
      client: { orgId: actor.orgId },
      OR: [
        { client: { access: { some: { membershipId: actor.membershipId, projectId: null } } } },
        { access: { some: { membershipId: actor.membershipId } } },
      ],
    },
  };
}

export class PrismaCampaignRepository implements CampaignRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
    private readonly ids: IdGenerator,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  /** A campaign is created with the column set it starts with, in one insert,
   * so the computed columns can reference the entered ones by id. */
  async create(context: TransactionContext, input: CampaignRecord): Promise<CampaignRecord> {
    const row = await this.client(context).campaign.create({
      data: {
        id: input.id,
        projectId: input.projectId,
        name: input.name,
        position: input.position,
        properties: {
          create: buildDefaultProperties(() => this.ids.generate()).map((property) => ({
            id: property.id, key: property.key, name: property.name,
            type: property.type, position: property.position, formula: toJson(property.formula),
          })),
        },
      },
    });
    return { id: row.id, projectId: row.projectId, name: row.name, position: row.position };
  }

  countForProject(projectId: string): Promise<number> {
    return this.prisma.campaign.count({ where: { projectId } });
  }

  async listForProject(projectId: string): Promise<CampaignRecord[]> {
    const rows = await this.prisma.campaign.findMany({
      where: { projectId }, orderBy: { position: "asc" },
    });
    return rows.map((row) => ({
      id: row.id, projectId: row.projectId, name: row.name, position: row.position,
    }));
  }

  async findReachable(actor: ActorContext, id: string): Promise<CampaignRecord | null> {
    const row = await this.prisma.campaign.findFirst({ where: { id, ...reachFilter(actor) } });
    return row && { id: row.id, projectId: row.projectId, name: row.name, position: row.position };
  }

  async readTable(actor: ActorContext, id: string): Promise<TableData | null> {
    const row = await this.prisma.campaign.findFirst({
      where: { id, ...reachFilter(actor) },
      include: {
        properties: { orderBy: { position: "asc" } },
        records: { orderBy: { date: "asc" }, include: { values: true } },
      },
    });
    if (!row) return null;
    return {
      campaign: { id: row.id, projectId: row.projectId, name: row.name, position: row.position },
      properties: row.properties.map(propertyToDomain),
      records: row.records.map((record) => ({
        id: record.id,
        // Formatted here so the domain never has to know about timezones.
        date: formatDate(record.date),
        storedValues: record.values.map((value) => ({
          propertyId: value.propertyId,
          numberValue: value.numberValue === null ? null : new Decimal(value.numberValue.toString()),
          textValue: value.textValue,
        })),
      })),
    };
  }

  async rename(context: TransactionContext, id: string, name: string): Promise<void> {
    await this.client(context).campaign.update({ where: { id }, data: { name } });
  }

  async delete(context: TransactionContext, id: string): Promise<void> {
    await this.client(context).campaign.delete({ where: { id } });
  }

  async renumber(
    context: TransactionContext,
    projectId: string,
    movedId?: string,
    position?: number,
  ): Promise<void> {
    const client = this.client(context);
    const siblings = await client.campaign.findMany({
      where: { projectId }, orderBy: { position: "asc" }, select: { id: true },
    });
    let ids = siblings.map((sibling) => sibling.id);
    if (movedId !== undefined && position !== undefined) {
      ids = ids.filter((id) => id !== movedId);
      ids.splice(Math.max(0, Math.min(position, ids.length)), 0, movedId);
    }
    await Promise.all(
      ids.map((id, index) => client.campaign.update({ where: { id }, data: { position: index } })),
    );
  }
}

export class PrismaPropertyRepository implements PropertyRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async siblings(campaignId: string): Promise<PropertyRecord[]> {
    const rows = await this.prisma.campaignProperty.findMany({
      where: { campaignId }, orderBy: { position: "asc" },
    });
    return rows.map(propertyToDomain);
  }

  async findReachable(actor: ActorContext, id: string): Promise<PropertyRecord | null> {
    const row = await this.prisma.campaignProperty.findFirst({
      where: { id, campaign: reachFilter(actor) },
    });
    return row && propertyToDomain(row);
  }

  async create(context: TransactionContext, input: PropertyRecord): Promise<PropertyRecord> {
    const row = await this.client(context).campaignProperty.create({
      data: {
        id: input.id, campaignId: input.campaignId, key: input.key, name: input.name,
        type: input.type, position: input.position, formula: toJson(input.formula),
      },
    });
    return propertyToDomain(row);
  }

  async shiftFrom(context: TransactionContext, campaignId: string, position: number): Promise<void> {
    await this.client(context).campaignProperty.updateMany({
      where: { campaignId, position: { gte: position } },
      data: { position: { increment: 1 } },
    });
  }

  async update(
    context: TransactionContext,
    id: string,
    data: { name?: string; type?: PropertyType; formula?: Expression | null },
  ): Promise<void> {
    await this.client(context).campaignProperty.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.formula !== undefined ? { formula: toJson(data.formula) } : {}),
      },
    });
  }

  async delete(context: TransactionContext, id: string): Promise<void> {
    await this.client(context).campaignProperty.delete({ where: { id } });
  }

  async renumber(
    context: TransactionContext,
    campaignId: string,
    movedId?: string,
    position?: number,
  ): Promise<void> {
    const client = this.client(context);
    const current = await client.campaignProperty.findMany({
      where: { campaignId }, orderBy: { position: "asc" }, select: { id: true },
    });
    let ids = current.map((property) => property.id);
    if (movedId !== undefined && position !== undefined) {
      ids = ids.filter((id) => id !== movedId);
      ids.splice(Math.max(0, Math.min(position, ids.length)), 0, movedId);
    }
    await Promise.all(
      ids.map((id, index) =>
        client.campaignProperty.update({ where: { id }, data: { position: index } })),
    );
  }

  countValues(propertyId: string): Promise<number> {
    return this.prisma.campaignPropertyValue.count({ where: { propertyId } });
  }
}

export class PrismaProjectReach implements ProjectReach {
  constructor(private readonly prisma: PrismaClient) {}

  async contextFor(actor: ActorContext, projectId: string) {
    const filter: Prisma.ProjectWhereInput = actor.role === "ADMIN"
      ? { client: { orgId: actor.orgId } }
      : {
          client: { orgId: actor.orgId },
          OR: [
            { client: { access: { some: { membershipId: actor.membershipId, projectId: null } } } },
            { access: { some: { membershipId: actor.membershipId } } },
          ],
        };
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...filter }, select: { clientId: true },
    });
    return project && { clientId: project.clientId };
  }
}

export class PrismaAuditContext implements AuditContextLookup {
  constructor(private readonly prisma: PrismaClient) {}

  async forCampaign(campaignId: string) {
    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { project: { select: { clientId: true } } },
    });
    return { clientId: campaign.project.clientId, projectId: campaign.projectId, campaignId };
  }
}

export { DEFAULT_CAMPAIGN_NAME };
