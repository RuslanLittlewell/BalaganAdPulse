import { isCustomer } from "@adpulse/access-policy";
import { Prisma } from "@prisma/client";
import type { PrismaClient, Task as TaskRow } from "@prisma/client";
import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { TaskColumn } from "../domain/board.js";
import { dateToDay, dayToDate } from "../domain/schedule.js";
import type {
  MemberReach,
  NamedMember,
  NewTask,
  ProjectReach,
  TaskChange,
  TaskFilter,
  TaskRecord,
  TaskRepository,
} from "../application/ports.js";
import { grantedProjects, reachableProjects } from "#shared/infrastructure/project-reach.js";

type ChecklistRow = { id: string; title: string; done: boolean; position: number };

type RowWithImages = TaskRow & {
  images?: { id: string }[];
  checklist?: ChecklistRow[];
  participants?: { membershipId: string }[];
};

function toDomain(row: RowWithImages, defaultTimeZone: string): TaskRecord {
  return {
    id: row.id, projectId: row.projectId, orgId: row.orgId, title: row.title,
    description: row.description ?? null, column: row.column, priority: row.priority,
    createdById: row.createdById,
    participantIds: (row.participants ?? []).map((participant) => participant.membershipId),
    visibleToClient: row.visibleToClient,
    position: row.position,
    dueDate: row.dueDate === null ? null : dateToDay(row.dueDate),
    dueTime: row.dueTime, endTime: row.endTime, repeatEvery: row.repeatEvery, isCall: row.isCall,
    skipWeekends: row.skipWeekends, timeZone: row.timeZone ?? defaultTimeZone,
    checklist: row.checklist ?? [],
    imageIds: (row.images ?? []).map((image) => image.id),
    archivedAt: row.archivedAt,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

const WITH_IMAGES = {
  images: { select: { id: true }, orderBy: { createdAt: "asc" } },
  checklist: {
    select: { id: true, title: true, done: true, position: true },
    orderBy: { position: "asc" },
  },
  participants: { select: { membershipId: true }, orderBy: { membershipId: "asc" } },
} as const;

function namedIn(actor: ActorContext): Prisma.TaskWhereInput {
  return { participants: { some: { membershipId: actor.membershipId } } };
}

function visibleTo(actor: ActorContext): Prisma.TaskWhereInput {
  if (actor.role === "ADMIN") return { orgId: actor.orgId };
  if (isCustomer(actor.role)) {
    return { orgId: actor.orgId, visibleToClient: true, project: grantedProjects(actor) };
  }
  return {
    orgId: actor.orgId,
    OR: [
      {
        project: grantedProjects(actor),
        OR: [namedIn(actor), { participants: { none: {} }, createdById: actor.membershipId }],
      },
      {
        projectId: null,
        OR: [namedIn(actor), { createdById: actor.membershipId }],
      },
    ],
  };
}

const BOARD_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { column: "asc" },
  { position: "asc" },
];

export class PrismaTaskRepository implements TaskRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
    private readonly defaultTimeZone: string,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async create(context: TransactionContext, input: NewTask): Promise<TaskRecord> {
    const { checklist = [], participantIds = [], ...task } = input;
    const row = await this.client(context).task.create({
      include: WITH_IMAGES,
      data: {
        ...task,
        archivedAt: task.column === "ARCHIVED" ? new Date() : null,
        dueDate: input.dueDate ? dayToDate(input.dueDate) : null,
        description: input.description === null || input.description === undefined
          ? undefined
          : (input.description as Prisma.InputJsonValue),
        checklist: checklist.length === 0
          ? undefined
          : {
              create: checklist.map((item, index) => ({
                id: item.id, title: item.title, done: item.done, position: index,
              })),
            },
        participants: participantIds.length === 0
          ? undefined
          : { create: participantIds.map((membershipId) => ({ membershipId })) },
      },
    });
    return toDomain(row, this.defaultTimeZone);
  }

  async findReachable(actor: ActorContext, id: string): Promise<TaskRecord | null> {
    const row = await this.prisma.task.findFirst({
      where: { id, ...visibleTo(actor) }, include: WITH_IMAGES,
    });
    return row && toDomain(row, this.defaultTimeZone);
  }

  async listReachable(actor: ActorContext, filter?: TaskFilter): Promise<TaskRecord[]> {
    const rows = await this.prisma.task.findMany({
      where: {
        ...visibleTo(actor),
        ...(filter?.projectId ? { projectId: filter.projectId } : {}),
        ...(filter?.dueFrom || filter?.dueTo
          ? {
              dueDate: {
                ...(filter.dueFrom ? { gte: dayToDate(filter.dueFrom) } : {}),
                ...(filter.dueTo ? { lte: dayToDate(filter.dueTo) } : {}),
              },
            }
          : {}),
      },
      orderBy: BOARD_ORDER,
      include: WITH_IMAGES,
    });
    return rows.map((row) => toDomain(row, this.defaultTimeZone));
  }

  async update(
    context: TransactionContext,
    id: string,
    input: TaskChange,
  ): Promise<TaskRecord> {
    const row = await this.client(context).task.update({
      where: { id },
      include: WITH_IMAGES,
      data: {
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
        ...(input.participantIds === undefined
          ? {}
          : {
              participants: {
                deleteMany: {},
                create: input.participantIds.map((membershipId) => ({ membershipId })),
              },
            }),
        ...(input.visibleToClient === undefined
          ? {}
          : { visibleToClient: input.visibleToClient }),
        ...(input.dueDate === undefined
          ? {}
          : { dueDate: input.dueDate === null ? null : dayToDate(input.dueDate) }),
        ...(input.dueTime === undefined ? {} : { dueTime: input.dueTime }),
        ...(input.endTime === undefined ? {} : { endTime: input.endTime }),
        ...(input.repeatEvery === undefined ? {} : { repeatEvery: input.repeatEvery }),
        ...(input.isCall === undefined ? {} : { isCall: input.isCall }),
        ...(input.skipWeekends === undefined ? {} : { skipWeekends: input.skipWeekends }),
        ...(input.timeZone === undefined ? {} : { timeZone: input.timeZone }),
        ...(input.description === undefined
          ? {}
          : { description: input.description === null
              ? Prisma.DbNull
              : (input.description as Prisma.InputJsonValue) }),
      },
    });
    return toDomain(row, this.defaultTimeZone);
  }

  async delete(context: TransactionContext, id: string): Promise<void> {
    await this.client(context).task.delete({ where: { id } });
  }

  countInColumn(orgId: string, column: TaskColumn): Promise<number> {
    return this.prisma.task.count({ where: { orgId, column } });
  }

  async columnIds(orgId: string, column: TaskColumn): Promise<string[]> {
    const rows = await this.prisma.task.findMany({
      where: { orgId, column }, orderBy: { position: "asc" }, select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async applyOrder(
    context: TransactionContext,
    column: TaskColumn,
    ids: readonly string[],
  ): Promise<void> {
    const client = this.client(context);
    await Promise.all(ids.map((id, index) =>
      client.task.update({ where: { id }, data: { column, position: index } })));
    if (column === "ARCHIVED") {
      await client.task.updateMany({
        where: { id: { in: [...ids] }, archivedAt: null }, data: { archivedAt: new Date() },
      });
    } else {
      await client.task.updateMany({
        where: { id: { in: [...ids] }, archivedAt: { not: null } }, data: { archivedAt: null },
      });
    }
  }

  async updateChecklist(
    context: TransactionContext,
    taskId: string,
    items: readonly { id: string; title: string; done: boolean }[],
  ): Promise<TaskRecord> {
    const client = this.client(context);
    await client.taskChecklistItem.deleteMany({ where: { taskId } });
    if (items.length > 0) {
      await client.taskChecklistItem.createMany({
        data: items.map((item, index) => ({
          id: item.id, taskId, title: item.title, done: item.done, position: index,
        })),
      });
    }
    return this.readWithin(context, taskId);
  }

  async untickChecklist(context: TransactionContext, taskId: string): Promise<void> {
    await this.client(context).taskChecklistItem.updateMany({
      where: { taskId }, data: { done: false },
    });
  }

  private async readWithin(context: TransactionContext, id: string): Promise<TaskRecord> {
    const row = await this.client(context).task.findUniqueOrThrow({
      where: { id }, include: WITH_IMAGES,
    });
    return toDomain(row, this.defaultTimeZone);
  }
}

export class PrismaTaskProjectReach implements ProjectReach {
  constructor(private readonly prisma: PrismaClient) {}

  async contextFor(actor: ActorContext, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...reachableProjects(actor) }, select: { clientId: true },
    });
    return project && { clientId: project.clientId };
  }
}

export class PrismaTaskMemberReach implements MemberReach {
  constructor(private readonly prisma: PrismaClient) {}

  async describe(
    actor: ActorContext,
    membershipIds: readonly string[],
    projectId: string | null,
  ): Promise<NamedMember[]> {
    if (membershipIds.length === 0) return [];
    const project = projectId === null
      ? null
      : await this.prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
    const rows = await this.prisma.membership.findMany({
      where: { id: { in: [...membershipIds] }, orgId: actor.orgId },
      select: { id: true, role: true, status: true, access: { select: { clientId: true, projectId: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      customer: isCustomer(row.role),
      active: row.status === "ACTIVE",
      reachesProject: project !== null && row.access.some((grant) =>
        grant.projectId === projectId
        || (grant.projectId === null && grant.clientId === project.clientId)),
    }));
  }
}

