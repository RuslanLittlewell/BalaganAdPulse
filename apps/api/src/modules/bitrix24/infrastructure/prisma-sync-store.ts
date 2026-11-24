import { Prisma, type PrismaClient } from "@prisma/client";
import { isLeadStage } from "#modules/leads/index.js";
import type {
  LeadWrite,
  LocalChange,
  RecordLink,
  RunRecord,
  SyncStore,
  TaskWrite,
} from "../application/ports.js";
import type { SyncKind } from "../domain/records.js";
import { toRun } from "./prisma-connection-repository.js";

const sql = Prisma.sql;
const NAME_LIMIT = 200;

interface ScanSpec {
  from: Prisma.Sql;
  watermark: Prisma.Sql;
  created: Prisma.Sql;
  org: Prisma.Sql;
}

const scanSpec = (kind: SyncKind, connectionId: string): ScanSpec => {
  const parent = (parentKind: SyncKind, column: Prisma.Sql) =>
    sql`JOIN bitrix24_link parent ON parent.connection_id = ${connectionId} AND parent.kind = ${parentKind} AND parent.local_id = ${column} AND NOT parent.dropped`;
  switch (kind) {
    case "COMPANY": return { from: sql`crm_company r`, watermark: sql`r.updated_at`, created: sql`r.created_at`, org: sql`r.org_id` };
    case "PERSON": return { from: sql`crm_person r`, watermark: sql`r.updated_at`, created: sql`r.created_at`, org: sql`r.org_id` };
    case "LEAD": return { from: sql`lead r`, watermark: sql`r.updated_at`, created: sql`r.created_at`, org: sql`r.org_id` };
    case "NOTE": return { from: sql`lead_note r ${parent("LEAD", sql`r.lead_id`)}`, watermark: sql`COALESCE(r.edited_at, r.created_at)`, created: sql`r.created_at`, org: sql`r.org_id` };
    case "TASK": return { from: sql`task r ${parent("LEAD", sql`r.lead_id`)}`, watermark: sql`r.updated_at`, created: sql`r.created_at`, org: sql`r.org_id` };
    case "COMMENT": return { from: sql`task_comment r JOIN task t ON t.id = r.task_id ${parent("TASK", sql`r.task_id`)}`, watermark: sql`COALESCE(r.edited_at, r.created_at)`, created: sql`r.created_at`, org: sql`t.org_id` };
  }
};

const iso = (date: Date) => date.toISOString();
const clip = (value: string | null, limit: number) => (value === null ? null : value.slice(0, limit));
const dateOnly = (value: Date | null) => (value ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) : null);

export class PrismaSyncStore implements SyncStore {
  constructor(private readonly prisma: PrismaClient) {}

  private toLink(row: { id: string; kind: string; localId: string; remoteId: string; remoteModifiedAt: Date | null; localSyncedAt: Date; dropped: boolean }): RecordLink {
    return { ...row, kind: row.kind as SyncKind };
  }

  async link(connectionId: string, kind: SyncKind, localId: string) {
    const row = await this.prisma.bitrix24Link.findUnique({ where: { connectionId_kind_localId: { connectionId, kind, localId } } });
    return row && this.toLink(row);
  }

  async linkByRemote(connectionId: string, kind: SyncKind, remoteId: string) {
    const row = await this.prisma.bitrix24Link.findUnique({ where: { connectionId_kind_remoteId: { connectionId, kind, remoteId } } });
    return row && this.toLink(row);
  }

  async saveLink(connectionId: string, link: { kind: SyncKind; localId: string; remoteId: string; remoteModifiedAt: Date | null; localSyncedAt: Date }) {
    const { kind, localId, remoteId, remoteModifiedAt, localSyncedAt } = link;
    await this.prisma.bitrix24Link.upsert({
      where: { connectionId_kind_localId: { connectionId, kind, localId } },
      create: { connectionId, kind, localId, remoteId, remoteModifiedAt, localSyncedAt },
      update: { remoteId, remoteModifiedAt, localSyncedAt, dropped: false },
    });
  }

  async dropLink(id: string) {
    await this.prisma.bitrix24Link.updateMany({ where: { id }, data: { dropped: true } });
  }

  async fail(connectionId: string, kind: string, key: string, reason: string, failedFor: Date | null) {
    await this.prisma.bitrix24Problem.upsert({
      where: { connectionId_kind_key: { connectionId, kind, key } },
      create: { connectionId, kind, key, reason: reason.slice(0, 500), failedFor },
      update: { reason: reason.slice(0, 500), failedFor },
    });
  }

  async clear(connectionId: string, kind: string, key: string) {
    await this.prisma.bitrix24Problem.deleteMany({ where: { connectionId, kind, key } });
  }

  async inbox(connectionId: string, limit: number) {
    const rows = await this.prisma.bitrix24Inbox.findMany({ where: { connectionId }, orderBy: { receivedAt: "asc" }, take: limit });
    return rows.map((row) => ({ id: row.id, kind: row.kind as SyncKind, remoteId: row.remoteId }));
  }

  async removeInbox(id: string) {
    await this.prisma.bitrix24Inbox.deleteMany({ where: { id } });
  }

  async changed(connection: { id: string; orgId: string; connectedAt: Date }, kind: SyncKind, options: { limit: number; unlinkedOnly: boolean; includeOld: boolean }): Promise<LocalChange[]> {
    const spec = scanSpec(kind, connection.id);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; watermark: Date }>>`
      SELECT r.id, ${spec.watermark} AS watermark
      FROM ${spec.from}
      LEFT JOIN bitrix24_link k ON k.connection_id = ${connection.id} AND k.kind = ${kind} AND k.local_id = r.id
      LEFT JOIN bitrix24_problem p ON p.connection_id = ${connection.id} AND p.kind = ${kind} AND p.key = r.id
      WHERE ${spec.org} = ${connection.orgId}
        AND (p.id IS NULL OR p.failed_for IS NULL OR p.failed_for < ${spec.watermark})
        AND (
          (k.id IS NULL AND (${options.includeOld}::boolean OR ${spec.created} > ${iso(connection.connectedAt)}::timestamp))
          OR (NOT ${options.unlinkedOnly}::boolean AND k.id IS NOT NULL AND NOT k.dropped AND ${spec.watermark} > k.local_synced_at)
        )
      ORDER BY ${spec.watermark} ASC
      LIMIT ${options.limit}`;
    return rows;
  }

  async advanceRun(runId: string, change: { created?: number; linked?: number; failed?: number; cursor?: Record<string, unknown>; state?: "DONE" | "FAILED" }) {
    await this.prisma.bitrix24Run.update({
      where: { id: runId },
      data: {
        ...(change.created ? { created: { increment: change.created } } : {}),
        ...(change.linked ? { linked: { increment: change.linked } } : {}),
        ...(change.failed ? { failed: { increment: change.failed } } : {}),
        ...(change.cursor ? { cursor: change.cursor as Prisma.InputJsonValue } : {}),
        ...(change.state ? { state: change.state, finishedAt: new Date() } : {}),
      },
    });
  }

  async runningRun(connectionId: string): Promise<RunRecord | null> {
    const row = await this.prisma.bitrix24Run.findFirst({ where: { connectionId, state: "RUNNING" }, orderBy: { startedAt: "asc" } });
    return row && toRun(row);
  }

  async unlinkedPeople(connectionId: string, clientId: string, keys: { phone: string | null; email: string | null }) {
    if (keys.phone === null && keys.email === null) return [];
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT r.id FROM crm_person r
      WHERE r.client_id = ${clientId}
        AND NOT EXISTS (SELECT 1 FROM bitrix24_link k WHERE k.connection_id = ${connectionId} AND k.kind = 'PERSON' AND k.local_id = r.id)
        AND ((${keys.phone}::text IS NOT NULL AND r.phone_digits = ${keys.phone})
          OR (${keys.email}::text IS NOT NULL AND lower(btrim(r.email)) = ${keys.email}))
      ORDER BY r.created_at ASC, r.id ASC
      LIMIT 20`;
    const people = await Promise.all(rows.map((row) => this.person(row.id)));
    return people.filter((person): person is NonNullable<typeof person> => person !== null);
  }

  async unlinkedCompanies(connectionId: string, clientId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT r.id FROM crm_company r
      WHERE r.client_id = ${clientId}
        AND NOT EXISTS (SELECT 1 FROM bitrix24_link k WHERE k.connection_id = ${connectionId} AND k.kind = 'COMPANY' AND k.local_id = r.id)
      ORDER BY r.created_at ASC, r.id ASC
      LIMIT 1000`;
    const companies = await Promise.all(rows.map((row) => this.company(row.id)));
    return companies.filter((company): company is NonNullable<typeof company> => company !== null);
  }

  async unlinkedLeads(connectionId: string, projectId: string, nameKey: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT r.id FROM lead r
      WHERE r.project_id = ${projectId}
        AND lower(btrim(r.name)) = ${nameKey}
        AND NOT EXISTS (SELECT 1 FROM bitrix24_link k WHERE k.connection_id = ${connectionId} AND k.kind = 'LEAD' AND k.local_id = r.id)
      ORDER BY r.created_at ASC, r.id ASC
      LIMIT 20`;
    const leads = await Promise.all(rows.map((row) => this.lead(row.id)));
    return leads.filter((lead): lead is NonNullable<typeof lead> => lead !== null);
  }

  async lead(id: string) {
    const row = await this.prisma.lead.findUnique({ where: { id }, include: { project: { select: { clientId: true } } } });
    if (!row) return null;
    return {
      id: row.id,
      orgId: row.orgId,
      projectId: row.projectId,
      clientId: row.project.clientId,
      name: row.name,
      amount: row.amount ? row.amount.toString() : null,
      source: row.source,
      notes: row.notes,
      stageKey: row.stage ?? row.columnId ?? "NEW",
      personId: row.personId,
      companyId: row.companyId,
      updatedAt: row.updatedAt,
    };
  }

  async person(id: string) {
    const row = await this.prisma.person.findUnique({ where: { id } });
    return row && { id: row.id, clientId: row.clientId, name: row.name, phone: row.phone, email: row.email, companyId: row.companyId, updatedAt: row.updatedAt };
  }

  async company(id: string) {
    const row = await this.prisma.company.findUnique({ where: { id } });
    return row && { id: row.id, clientId: row.clientId, name: row.name, phone: row.phone, website: row.website, updatedAt: row.updatedAt };
  }

  async note(id: string) {
    const row = await this.prisma.leadNote.findUnique({ where: { id }, include: { author: { select: { user: { select: { name: true } } } } } });
    return row && { id: row.id, leadId: row.leadId, body: row.body, authorName: row.author?.user.name ?? null, watermark: row.editedAt ?? row.createdAt };
  }

  async task(id: string) {
    const row = await this.prisma.task.findUnique({ where: { id }, include: { assignee: { select: { user: { select: { email: true } } } } } });
    if (!row || !row.leadId) return null;
    return {
      id: row.id,
      leadId: row.leadId,
      title: row.title,
      description: row.description,
      dueDate: row.dueDate,
      done: row.column === "DONE" || row.doneAt !== null,
      assigneeEmail: row.assignee?.user.email ?? null,
      updatedAt: row.updatedAt,
    };
  }

  async comment(id: string) {
    const row = await this.prisma.taskComment.findUnique({ where: { id }, include: { author: { select: { user: { select: { name: true } } } } } });
    return row && { id: row.id, taskId: row.taskId, body: row.body, authorName: row.author?.user.name ?? null, watermark: row.editedAt ?? row.createdAt };
  }

  async projectClient(projectId: string) {
    return (await this.prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } }))?.clientId ?? null;
  }

  async stageInProject(stageKey: string, projectId: string) {
    if (isLeadStage(stageKey)) return true;
    return (await this.prisma.leadColumn.count({ where: { id: stageKey, projectId } })) > 0;
  }

  async membershipByEmail(orgId: string, email: string) {
    const row = await this.prisma.membership.findFirst({
      where: { orgId, status: "ACTIVE", user: { email: { equals: email, mode: "insensitive" } } },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  private placement(stageKey: string) {
    return isLeadStage(stageKey) ? { stage: stageKey, columnId: null } : { stage: null, columnId: stageKey };
  }

  private async makeRoom(tx: Prisma.TransactionClient, projectId: string, stageKey: string) {
    if (isLeadStage(stageKey)) {
      await tx.$executeRaw`UPDATE lead SET position = position + 1 WHERE project_id = ${projectId} AND stage = ${stageKey}::lead_stage`;
    } else {
      await tx.$executeRaw`UPDATE lead SET position = position + 1 WHERE project_id = ${projectId} AND column_id = ${stageKey}`;
    }
  }

  private leadData(write: LeadWrite) {
    return {
      name: write.name.slice(0, NAME_LIMIT),
      amount: write.amount,
      source: clip(write.source, NAME_LIMIT),
      notes: clip(write.notes, 10_000),
      personId: write.personId,
      companyId: write.companyId,
    };
  }

  async createLead(orgId: string, projectId: string, write: LeadWrite & { stageKey: string }) {
    return this.prisma.$transaction(async (tx) => {
      await this.makeRoom(tx, projectId, write.stageKey);
      const row = await tx.lead.create({
        data: { orgId, projectId, origin: "MANUAL", position: 0, ...this.placement(write.stageKey), ...this.leadData(write) },
        select: { id: true, updatedAt: true },
      });
      return row;
    });
  }

  async updateLead(id: string, write: LeadWrite) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.lead.findUniqueOrThrow({ where: { id }, select: { projectId: true, stage: true, columnId: true } });
      const moving = write.stageKey !== undefined && write.stageKey !== (current.stage ?? current.columnId);
      if (moving) await this.makeRoom(tx, current.projectId, write.stageKey!);
      const row = await tx.lead.update({
        where: { id },
        data: { ...this.leadData(write), ...(moving ? { ...this.placement(write.stageKey!), position: 0 } : {}) },
        select: { updatedAt: true },
      });
      return row.updatedAt;
    });
  }

  async createPerson(orgId: string, clientId: string, write: { name: string; phone: string | null; email: string | null; companyId: string | null }) {
    return this.prisma.person.create({
      data: { orgId, clientId, name: write.name.slice(0, NAME_LIMIT), phone: clip(write.phone, 50), email: clip(write.email, 254), companyId: write.companyId },
      select: { id: true, updatedAt: true },
    });
  }

  async updatePerson(id: string, write: { name: string; phone: string | null; email: string | null; companyId: string | null }) {
    const row = await this.prisma.person.update({
      where: { id },
      data: { name: write.name.slice(0, NAME_LIMIT), phone: clip(write.phone, 50), email: clip(write.email, 254), companyId: write.companyId },
      select: { updatedAt: true },
    });
    return row.updatedAt;
  }

  async createCompany(orgId: string, clientId: string, write: { name: string; phone: string | null; website: string | null }) {
    return this.prisma.company.create({
      data: { orgId, clientId, name: write.name.slice(0, NAME_LIMIT), phone: clip(write.phone, 50), website: clip(write.website, 2048) },
      select: { id: true, updatedAt: true },
    });
  }

  async updateCompany(id: string, write: { name: string; phone: string | null; website: string | null }) {
    const row = await this.prisma.company.update({
      where: { id },
      data: { name: write.name.slice(0, NAME_LIMIT), phone: clip(write.phone, 50), website: clip(write.website, 2048) },
      select: { updatedAt: true },
    });
    return row.updatedAt;
  }

  async createNote(orgId: string, leadId: string, body: string) {
    const row = await this.prisma.leadNote.create({ data: { orgId, leadId, authorId: null, body: body.slice(0, 5000) }, select: { id: true, createdAt: true } });
    return { id: row.id, watermark: row.createdAt };
  }

  async updateNote(id: string, body: string) {
    const row = await this.prisma.leadNote.update({ where: { id }, data: { body: body.slice(0, 5000), editedAt: new Date() }, select: { editedAt: true } });
    return row.editedAt!;
  }

  private async makeTaskRoom(tx: Prisma.TransactionClient, orgId: string, column: "DONE" | "QUEUED") {
    await tx.$executeRaw`UPDATE task SET position = position + 1 WHERE org_id = ${orgId} AND "column" = ${column}::task_column`;
  }

  async createTask(orgId: string, leadId: string, write: TaskWrite) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId }, select: { projectId: true } });
      const column = write.done ? "DONE" as const : "QUEUED" as const;
      await this.makeTaskRoom(tx, orgId, column);
      return tx.task.create({
        data: {
          orgId,
          projectId: lead.projectId,
          leadId,
          title: write.title,
          description: write.description == null ? Prisma.JsonNull : write.description as Prisma.InputJsonValue,
          column,
          priority: "MEDIUM",
          position: 0,
          dueDate: dateOnly(write.dueDate),
          assigneeId: write.assigneeId,
          doneAt: write.done ? new Date() : null,
        },
        select: { id: true, updatedAt: true },
      });
    });
  }

  async updateTask(id: string, write: TaskWrite) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.task.findUniqueOrThrow({ where: { id }, select: { orgId: true, column: true, doneAt: true } });
      const isDone = current.column === "DONE" || current.doneAt !== null;
      const column = write.done && !isDone ? "DONE" as const : !write.done && isDone ? "QUEUED" as const : null;
      if (column) await this.makeTaskRoom(tx, current.orgId, column);
      const row = await tx.task.update({
        where: { id },
        data: {
          title: write.title,
          dueDate: dateOnly(write.dueDate),
          assigneeId: write.assigneeId,
          ...(write.description !== undefined ? { description: write.description == null ? Prisma.JsonNull : write.description as Prisma.InputJsonValue } : {}),
          ...(column ? { column, position: 0, doneAt: column === "DONE" ? new Date() : null, archivedAt: null } : {}),
        },
        select: { updatedAt: true },
      });
      return row.updatedAt;
    });
  }

  async createComment(taskId: string, body: string) {
    const row = await this.prisma.taskComment.create({ data: { taskId, authorId: null, body, mentionIds: [] }, select: { id: true, createdAt: true } });
    return { id: row.id, watermark: row.createdAt };
  }

  async updateComment(id: string, body: string) {
    const row = await this.prisma.taskComment.update({ where: { id }, data: { body, editedAt: new Date() }, select: { editedAt: true } });
    return row.editedAt!;
  }
}
