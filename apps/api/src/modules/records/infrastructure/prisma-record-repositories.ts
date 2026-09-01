import { Prisma, type PrismaClient } from "@prisma/client";
import type { ActorContext, TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import { formatDate } from "../../../shared/infrastructure/date.js";
import type { Expression, PropertyType } from "../../campaigns/index.js";
import type { StoredCell, WritableProperty } from "../domain/value.js";
import type { RecordRepository, RecordRow, ValueRepository } from "../application/ports.js";

function toRow(row: { id: string; campaignId: string; date: Date }): RecordRow {
  return { id: row.id, campaignId: row.campaignId, date: formatDate(row.date) };
}

/** Which rows an actor can reach, derived from the campaign filter. */
function reachFilter(actor: ActorContext): Prisma.CampaignRecordWhereInput {
  const project: Prisma.ProjectWhereInput = actor.role === "ADMIN"
    ? { client: { orgId: actor.orgId } }
    : {
        client: { orgId: actor.orgId },
        OR: [
          { client: { access: { some: { membershipId: actor.membershipId, projectId: null } } } },
          { access: { some: { membershipId: actor.membershipId } } },
        ],
      };
  return { campaign: { project } };
}

export class PrismaRecordRepository implements RecordRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async create(
    context: TransactionContext,
    input: { id: string; campaignId: string; date: Date },
  ): Promise<RecordRow> {
    return toRow(await this.client(context).campaignRecord.create({ data: input }));
  }

  async findReachable(actor: ActorContext, id: string): Promise<RecordRow | null> {
    const row = await this.prisma.campaignRecord.findFirst({ where: { id, ...reachFilter(actor) } });
    return row && toRow(row);
  }

  async findByDay(campaignId: string, date: Date): Promise<RecordRow | null> {
    const row = await this.prisma.campaignRecord.findUnique({
      where: { campaignId_date: { campaignId, date } },
    });
    return row && toRow(row);
  }

  async update(context: TransactionContext, id: string, date: Date): Promise<RecordRow> {
    return toRow(await this.client(context).campaignRecord.update({ where: { id }, data: { date } }));
  }

  async delete(context: TransactionContext, id: string): Promise<void> {
    await this.client(context).campaignRecord.delete({ where: { id } });
  }
}

export class PrismaValueRepository implements ValueRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async propertiesOf(
    campaignId: string,
    propertyIds: readonly string[],
  ): Promise<WritableProperty[]> {
    const rows = await this.prisma.campaignProperty.findMany({
      where: { id: { in: [...propertyIds] }, campaignId },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as PropertyType,
      formula: row.formula === null ? null : (row.formula as unknown as Expression),
    }));
  }

  /** Values already stored, as the strings the audit trail records them in. */
  async storedFor(
    recordId: string,
    propertyIds: readonly string[],
  ): Promise<Map<string, StoredCell>> {
    const rows = await this.prisma.campaignPropertyValue.findMany({
      where: { recordId, propertyId: { in: [...propertyIds] } },
    });
    return new Map(rows.map((row) => [row.propertyId, {
      numberValue: row.numberValue === null ? null : row.numberValue.toFixed(4),
      textValue: row.textValue,
    }]));
  }

  /** A cleared cell is deleted rather than stored as null, so "no value" has
   * exactly one representation. */
  async write(
    context: TransactionContext,
    recordId: string,
    property: WritableProperty,
    value: string | null,
  ): Promise<void> {
    const client = this.client(context);
    if (value === null) {
      await client.campaignPropertyValue.deleteMany({ where: { recordId, propertyId: property.id } });
      return;
    }
    const data = property.type === "TEXT"
      ? { textValue: value, numberValue: null }
      : { numberValue: value, textValue: null };
    await client.campaignPropertyValue.upsert({
      where: { recordId_propertyId: { recordId, propertyId: property.id } },
      create: { recordId, propertyId: property.id, ...data },
      update: data,
    });
  }
}
