import type { Bitrix24Connection, Bitrix24Run, PrismaClient } from "@prisma/client";
import { LEAD_STAGES, LEAD_STAGE_NAMES } from "#modules/leads/index.js";
import { liveOrganizationFilter } from "#shared/infrastructure/live-organization.js";
import type {
  ConnectionChange,
  ConnectionRepository,
  ConnectionStatus,
  ProblemRecord,
  RunDirection,
  RunRecord,
  StageLink,
  StageOption,
  StoredConnection,
} from "../application/ports.js";
import type { SyncKind } from "../domain/records.js";

export function toConnection(row: Bitrix24Connection): StoredConnection {
  return {
    id: row.id,
    orgId: row.orgId,
    portalHost: row.portalHost,
    sealedWebhook: row.sealedWebhook,
    tokenHash: row.tokenHash,
    webhookKey: row.webhookKey,
    status: row.status as ConnectionStatus,
    enabled: row.enabled,
    inboundProjectId: row.inboundProjectId,
    connectedAt: row.connectedAt,
    lastSyncAt: row.lastSyncAt,
    lastError: row.lastError,
  };
}

export function toRun(row: Bitrix24Run): RunRecord {
  return {
    id: row.id,
    direction: row.direction as RunDirection,
    state: row.state as RunRecord["state"],
    created: row.created,
    linked: row.linked,
    failed: row.failed,
    cursor: row.cursor && typeof row.cursor === "object" && !Array.isArray(row.cursor) ? row.cursor as Record<string, unknown> : {},
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

export class PrismaConnectionRepository implements ConnectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrg(orgId: string) {
    const row = await this.prisma.bitrix24Connection.findUnique({ where: { orgId } });
    return row && toConnection(row);
  }

  async findByKey(key: string) {
    const row = await this.prisma.bitrix24Connection.findUnique({ where: { webhookKey: key } });
    return row && toConnection(row);
  }

  async create(input: { orgId: string; portalHost: string; sealedWebhook: string; tokenHash: string; webhookKey: string; connectedAt: Date }) {
    return toConnection(await this.prisma.bitrix24Connection.create({ data: input }));
  }

  async update(id: string, change: ConnectionChange) {
    return toConnection(await this.prisma.bitrix24Connection.update({ where: { id }, data: change }));
  }

  async remove(id: string) {
    await this.prisma.bitrix24Connection.deleteMany({ where: { id } });
  }

  async stageLinks(connectionId: string): Promise<StageLink[]> {
    return this.prisma.bitrix24StageLink.findMany({ where: { connectionId }, select: { stageKey: true, statusId: true } });
  }

  async setStageLinks(connectionId: string, links: readonly StageLink[]) {
    await this.prisma.$transaction([
      this.prisma.bitrix24StageLink.deleteMany({ where: { connectionId } }),
      this.prisma.bitrix24StageLink.createMany({ data: links.map((link) => ({ connectionId, ...link })) }),
      this.prisma.bitrix24Problem.deleteMany({ where: { connectionId, kind: "STATUS", key: { in: links.map((link) => link.statusId) } } }),
    ]);
  }

  async stageOptions(orgId: string): Promise<StageOption[]> {
    const columns = await this.prisma.leadColumn.findMany({
      where: { orgId },
      select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
      orderBy: [{ projectId: "asc" }, { position: "asc" }],
    });
    return [
      ...LEAD_STAGES.map((stage) => ({ key: stage, name: LEAD_STAGE_NAMES[stage], projectId: null, projectName: null })),
      ...columns.map((column) => ({ key: column.id, name: column.name, projectId: column.projectId, projectName: column.project.name })),
    ];
  }

  async projectInOrganization(orgId: string, projectId: string) {
    return (await this.prisma.project.count({ where: { id: projectId, client: { orgId } } })) > 0;
  }

  async problems(connectionId: string): Promise<ProblemRecord[]> {
    const rows = await this.prisma.bitrix24Problem.findMany({ where: { connectionId }, orderBy: { createdAt: "desc" }, take: 200 });
    const ids = (kind: string) => rows.filter((row) => row.kind === kind && !row.key.startsWith("remote:")).map((row) => row.key);
    const [leads, people, companies] = await Promise.all([
      this.prisma.lead.findMany({ where: { id: { in: ids("LEAD") } }, select: { id: true, name: true } }),
      this.prisma.person.findMany({ where: { id: { in: ids("PERSON") } }, select: { id: true, name: true } }),
      this.prisma.company.findMany({ where: { id: { in: ids("COMPANY") } }, select: { id: true, name: true } }),
    ]);
    const names = new Map([...leads, ...people, ...companies].map((row) => [row.id, row.name]));
    return rows.map((row) => ({ kind: row.kind, key: row.key, reason: row.reason, label: names.get(row.key) ?? null, createdAt: row.createdAt }));
  }

  async latestRun(connectionId: string) {
    const row = await this.prisma.bitrix24Run.findFirst({ where: { connectionId }, orderBy: { startedAt: "desc" } });
    return row && toRun(row);
  }

  async startRun(connectionId: string, direction: RunDirection) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM bitrix24_connection WHERE id = ${connectionId} FOR UPDATE`;
      if (await tx.bitrix24Run.count({ where: { connectionId, state: "RUNNING" } })) return null;
      return toRun(await tx.bitrix24Run.create({ data: { connectionId, direction } }));
    });
  }

  async enqueue(connectionId: string, kind: SyncKind, remoteId: string) {
    await this.prisma.bitrix24Inbox.createMany({ data: [{ connectionId, kind, remoteId }], skipDuplicates: true });
  }

  async requeueSkipped(connectionId: string) {
    const skipped = await this.prisma.bitrix24Problem.findMany({
      where: { connectionId, reason: "NO_INBOUND_PROJECT", key: { startsWith: "remote:" } },
    });
    if (skipped.length === 0) return;
    await this.prisma.$transaction([
      this.prisma.bitrix24Inbox.createMany({
        data: skipped.map((problem) => ({ connectionId, kind: problem.kind, remoteId: problem.key.slice("remote:".length) })),
        skipDuplicates: true,
      }),
      this.prisma.bitrix24Problem.deleteMany({ where: { id: { in: skipped.map((problem) => problem.id) } } }),
    ]);
  }

  async claim(now: Date, owner: string, leaseMs: number, exclude: readonly string[]) {
    const available = {
      enabled: true,
      status: "ACTIVE",
      org: liveOrganizationFilter(now),
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    };
    const candidate = await this.prisma.bitrix24Connection.findFirst({
      where: { ...available, id: { notIn: [...exclude] } },
      orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } },
      select: { id: true },
    });
    if (!candidate) return null;
    const claimed = await this.prisma.bitrix24Connection.updateMany({
      where: { ...available, id: candidate.id },
      data: { leaseOwner: owner, leaseUntil: new Date(now.getTime() + leaseMs) },
    });
    if (!claimed.count) return null;
    const row = await this.prisma.bitrix24Connection.findUnique({ where: { id: candidate.id } });
    return row && toConnection(row);
  }

  async release(id: string, owner: string) {
    await this.prisma.bitrix24Connection.updateMany({ where: { id, leaseOwner: owner }, data: { leaseOwner: null, leaseUntil: null } });
  }
}
