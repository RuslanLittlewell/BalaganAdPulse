import { isCustomer } from "@adpulse/access-policy";
import { Prisma } from "@prisma/client";
import type { PrismaClient, Task as TaskRow } from "@prisma/client";
import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import { TASK_COLUMNS, type TaskColumn } from "../domain/board.js";
import { dateToDay, dayToDate } from "../domain/schedule.js";
import type {
  MemberReach,
  NewTask,
  ProjectReach,
  TaskChange,
  TaskFilter,
  TaskRecord,
  TaskRepository,
} from "../application/ports.js";

type ChecklistRow = { id: string; title: string; done: boolean; position: number };

type RowWithImages = TaskRow & { images?: { id: string }[]; checklist?: ChecklistRow[] };

function toDomain(row: RowWithImages): TaskRecord {
  return {
    id: row.id, projectId: row.projectId, orgId: row.orgId, title: row.title,
    description: row.description ?? null, column: row.column, priority: row.priority,
    assigneeId: row.assigneeId, createdById: row.createdById,
    campaignId: row.campaignId, visibleToClient: row.visibleToClient,
    position: row.position,
    dueDate: row.dueDate === null ? null : dateToDay(row.dueDate),
    dueTime: row.dueTime, repeatEvery: row.repeatEvery,
    checklist: row.checklist ?? [],
    imageIds: (row.images ?? []).map((image) => image.id),
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

const WITH_IMAGES = {
  images: { select: { id: true }, orderBy: { createdAt: "asc" } },
  checklist: {
    select: { id: true, title: true, done: true, position: true },
    orderBy: { position: "asc" },
  },
} as const;

const grantedProject = (actor: ActorContext): Prisma.ProjectWhereInput => ({
  OR: [
    { client: { access: { some: { membershipId: actor.membershipId, projectId: null } } } },
    { access: { some: { membershipId: actor.membershipId } } },
  ],
});

function visibleTo(actor: ActorContext): Prisma.TaskWhereInput {
  if (actor.role === "ADMIN") return { orgId: actor.orgId };
  if (isCustomer(actor.role)) {
    return { orgId: actor.orgId, visibleToClient: true, project: grantedProject(actor) };
  }
  return {
    orgId: actor.orgId,
    OR: [
      { project: grantedProject(actor), assigneeId: actor.membershipId },
      {
        projectId: null,
        OR: [{ createdById: actor.membershipId }, { assigneeId: actor.membershipId }],
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
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async create(context: TransactionContext, input: NewTask): Promise<TaskRecord> {
    const { checklist = [], ...task } = input;
    const row = await this.client(context).task.create({
      include: WITH_IMAGES,
      data: {
        ...task,
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
      },
    });
    return toDomain(row);
  }

  async findReachable(actor: ActorContext, id: string): Promise<TaskRecord | null> {
    const row = await this.prisma.task.findFirst({
      where: { id, ...visibleTo(actor) }, include: WITH_IMAGES,
    });
    return row && toDomain(row);
  }

  async listReachable(actor: ActorContext, filter?: TaskFilter): Promise<TaskRecord[]> {
    const rows = await this.prisma.task.findMany({
      where: {
        ...visibleTo(actor),
        ...(filter?.projectId ? { projectId: filter.projectId } : {}),
        ...(filter?.campaignId ? { campaignId: filter.campaignId } : {}),
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
    return rows.map(toDomain);
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
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
        ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
        ...(input.visibleToClient === undefined
          ? {}
          : { visibleToClient: input.visibleToClient }),
        ...(input.dueDate === undefined
          ? {}
          : { dueDate: input.dueDate === null ? null : dayToDate(input.dueDate) }),
        ...(input.dueTime === undefined ? {} : { dueTime: input.dueTime }),
        ...(input.repeatEvery === undefined ? {} : { repeatEvery: input.repeatEvery }),
        ...(input.description === undefined
          ? {}
          : { description: input.description === null
              ? Prisma.DbNull
              : (input.description as Prisma.InputJsonValue) }),
      },
    });
    return toDomain(row);
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
    return toDomain(row);
  }
}

export class PrismaTaskProjectReach implements ProjectReach {
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

export class PrismaTaskMemberReach implements MemberReach {
  constructor(private readonly prisma: PrismaClient) {}

  async isAssignable(actor: ActorContext, membershipId: string): Promise<boolean> {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, orgId: actor.orgId, status: "ACTIVE" },
      select: { id: true },
    });
    return membership !== null;
  }
}

export { TASK_COLUMNS };
