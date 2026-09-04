import { isCustomer } from "@adpulse/access-policy";
import { Prisma } from "@prisma/client";
import type { PrismaClient, Task as TaskRow } from "@prisma/client";
import type { ActorContext, TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import { TASK_COLUMNS, type TaskColumn } from "../domain/board.js";
import type {
  MemberReach,
  NewTask,
  ProjectReach,
  TaskChange,
  TaskFilter,
  TaskRecord,
  TaskRepository,
} from "../application/ports.js";

type RowWithImages = TaskRow & { images?: { id: string }[] };

function toDomain(row: RowWithImages): TaskRecord {
  return {
    id: row.id, projectId: row.projectId, orgId: row.orgId, title: row.title,
    description: row.description ?? null, column: row.column, priority: row.priority,
    assigneeId: row.assigneeId, createdById: row.createdById,
    campaignId: row.campaignId, visibleToClient: row.visibleToClient,
    position: row.position,
    imageIds: (row.images ?? []).map((image) => image.id),
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

/** Ids only: the board shows that a card has attachments, never their bytes. */
const WITH_IMAGES = { images: { select: { id: true }, orderBy: { createdAt: "asc" } } } as const;

/**
 * Which tasks an actor can reach: exactly those whose project they reach, which
 * is why this mirrors the projects module's filter rather than inventing one.
 * A grant naming a single project narrows to that project's tasks alone.
 */
function reachFilter(actor: ActorContext): Prisma.TaskWhereInput {
  if (actor.role === "ADMIN") return { orgId: actor.orgId };
  return {
    orgId: actor.orgId,
    project: {
      OR: [
        { client: { access: { some: { membershipId: actor.membershipId, projectId: null } } } },
        { access: { some: { membershipId: actor.membershipId } } },
      ],
    },
  };
}

/**
 * Whose work the actor sees, asked after reach has decided which projects they
 * may look at. It only ever takes rows away from what reach allowed.
 *
 * An admin sees the organization's work. A customer — either role — sees what is
 * marked as shown to them. A manager or guest sees the work they are responsible
 * for and nothing else — including nothing that is nobody's yet,
 * which is the point: a request waits on the admin's board until an admin makes
 * somebody responsible for it. A customer sees the tasks marked as shown to them.
 */
function ownershipFilter(actor: ActorContext): Prisma.TaskWhereInput {
  if (actor.role === "ADMIN") return {};
  if (isCustomer(actor.role)) return { visibleToClient: true };
  return { assigneeId: actor.membershipId };
}

/** The board reads column-major, in the order the columns are drawn. Postgres
 * orders an enum by its declared order, which is the same order. */
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
    const row = await this.client(context).task.create({
      include: WITH_IMAGES,
      data: {
        ...input,
        description: input.description === null || input.description === undefined
          ? undefined
          : (input.description as Prisma.InputJsonValue),
      },
    });
    return toDomain(row);
  }

  async findReachable(actor: ActorContext, id: string): Promise<TaskRecord | null> {
    const row = await this.prisma.task.findFirst({
      where: { id, ...reachFilter(actor), ...ownershipFilter(actor) }, include: WITH_IMAGES,
    });
    return row && toDomain(row);
  }

  async listReachable(actor: ActorContext, filter?: TaskFilter): Promise<TaskRecord[]> {
    const rows = await this.prisma.task.findMany({
      // Reach first, then the narrowing: a filter can only take rows away from
      // what the actor already reaches.
      where: {
        ...reachFilter(actor),
        ...ownershipFilter(actor),
        ...(filter?.projectId ? { projectId: filter.projectId } : {}),
        ...(filter?.campaignId ? { campaignId: filter.campaignId } : {}),
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

  /** Writes the whole column back as 0..n-1. Bounded by the size of a column,
   * which is the trade the design makes for never leaving a gap or a duplicate. */
  async applyOrder(
    context: TransactionContext,
    column: TaskColumn,
    ids: readonly string[],
  ): Promise<void> {
    const client = this.client(context);
    await Promise.all(ids.map((id, index) =>
      client.task.update({ where: { id }, data: { column, position: index } })));
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

/** A task may only be given to an active member of the actor's own organization. */
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
