import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ActorContext } from "#shared/application/index.js";
import { reachableProjects } from "#shared/infrastructure/project-reach.js";
import type { BotMembership } from "../domain/link.js";
import type { TaskCatalog, TaskDraft } from "../domain/draft.js";
import type {
  LinkTokens,
  StoredDraft,
  TaskCatalogs,
  TaskDrafts,
  TelegramChat,
  TelegramLinks,
  TelegramLinkView,
  TelegramMembers,
} from "../application/ports.js";

const TOKEN_BYTES = 24;
const CATALOG_PROJECTS = 300;
const STAFF_ROLES = ["ADMIN", "MANAGER", "GUEST"] as const;

export class RandomLinkTokens implements LinkTokens {
  issue(): { token: string; hash: string } {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}

export class PrismaTelegramLinks implements TelegramLinks {
  constructor(private readonly prisma: PrismaClient) {}

  async find(membershipId: string): Promise<TelegramLinkView | null> {
    return this.prisma.telegramLink.findUnique({
      where: { membershipId }, select: { username: true, linkedAt: true, notifications: true },
    });
  }

  async chatFor(membershipId: string): Promise<number | null> {
    const link = await this.prisma.telegramLink.findFirst({
      where: { membershipId, notifications: true }, select: { chatId: true },
    });
    return link ? Number(link.chatId) : null;
  }

  async setNotifications(membershipId: string, on: boolean): Promise<boolean> {
    const { count } = await this.prisma.telegramLink.updateMany({ where: { membershipId }, data: { notifications: on } });
    return count > 0;
  }

  async memberOf(chatId: number): Promise<string | null> {
    const link = await this.prisma.telegramLink.findUnique({
      where: { chatId: BigInt(chatId) }, select: { membershipId: true },
    });
    return link?.membershipId ?? null;
  }

  async issueToken(membershipId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.telegramLinkToken.upsert({
      where: { membershipId },
      create: { membershipId, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });
  }

  async redeem(tokenHash: string, now: Date, chat: TelegramChat): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.telegramLinkToken.findUnique({ where: { tokenHash } });
      if (!token) return null;
      const { count } = await tx.telegramLinkToken.deleteMany({ where: { tokenHash } });
      if (count === 0 || token.expiresAt <= now) return null;
      const chatId = BigInt(chat.id);
      await tx.telegramLink.deleteMany({ where: { OR: [{ membershipId: token.membershipId }, { chatId }] } });
      await tx.telegramLink.create({
        data: { membershipId: token.membershipId, chatId, username: chat.username, linkedAt: now },
      });
      return token.membershipId;
    });
  }

  async unlink(membershipId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.telegramLink.deleteMany({ where: { membershipId } }),
      this.prisma.telegramLinkToken.deleteMany({ where: { membershipId } }),
    ]);
  }
}

export class PrismaTelegramMembers implements TelegramMembers {
  constructor(private readonly prisma: PrismaClient) {}

  async describe(membershipId: string): Promise<(BotMembership & { actor: ActorContext }) | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      select: {
        id: true, userId: true, orgId: true, role: true, status: true,
        org: { select: { status: true, modules: true } },
      },
    });
    if (!membership) return null;
    return {
      role: membership.role,
      active: membership.status === "ACTIVE",
      organizationActive: membership.org.status === "ACTIVE",
      tasksOn: membership.org.modules.includes("TASKS"),
      actor: {
        userId: membership.userId,
        membershipId: membership.id,
        orgId: membership.orgId,
        role: membership.role,
      },
    };
  }
}

export class PrismaTaskCatalogs implements TaskCatalogs {
  constructor(private readonly prisma: PrismaClient) {}

  async catalog(actor: ActorContext): Promise<TaskCatalog> {
    const [projects, members] = await Promise.all([
      this.prisma.project.findMany({
        where: reachableProjects(actor),
        select: { id: true, name: true, client: { select: { name: true } } },
        orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
        take: CATALOG_PROJECTS,
      }),
      this.prisma.membership.findMany({
        where: { orgId: actor.orgId, status: "ACTIVE", role: { in: [...STAFF_ROLES] } },
        select: { id: true, user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
    ]);
    return {
      projects: projects.map((project) => ({ id: project.id, name: project.name, client: project.client.name })),
      members: members.map((member) => ({ id: member.id, name: member.user.name })),
    };
  }
}

export class PrismaTaskDrafts implements TaskDrafts {
  constructor(private readonly prisma: PrismaClient) {}

  async save(id: string, chatId: number, stored: StoredDraft, at: Date): Promise<void> {
    await this.prisma.telegramTaskDraft.create({
      data: {
        id,
        chatId: BigInt(chatId),
        membershipId: stored.membershipId,
        draft: stored.draft as unknown as Prisma.InputJsonValue,
        createdAt: at,
      },
    });
  }

  async take(id: string, chatId: number, notBefore: Date): Promise<StoredDraft | null> {
    const where = { id, chatId: BigInt(chatId), createdAt: { gte: notBefore } };
    const row = await this.prisma.telegramTaskDraft.findFirst({ where });
    if (!row) return null;
    const { count } = await this.prisma.telegramTaskDraft.deleteMany({ where });
    return count === 1 ? { membershipId: row.membershipId, draft: row.draft as unknown as TaskDraft } : null;
  }

  async sweep(before: Date): Promise<void> {
    await this.prisma.telegramTaskDraft.deleteMany({ where: { createdAt: { lt: before } } });
  }
}
