import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { LINK_TOKEN_TTL_MS, linkUrl, mayUseBot } from "../domain/link.js";
import type { TelegramChat, TelegramLinkDependencies, TelegramMembers } from "./ports.js";

export interface TelegramStatus {
  readonly available: boolean;
  readonly linked: boolean;
  readonly username: string | null;
  readonly linkedAt: Date | null;
  readonly notifications: boolean;
}

export async function botActorOf(members: TelegramMembers, membershipId: string): Promise<ActorContext | null> {
  const membership = await members.describe(membershipId);
  return membership && mayUseBot(membership) ? membership.actor : null;
}

export function createTelegramLinkUseCases(d: TelegramLinkDependencies) {
  const available = async (actor: ActorContext) =>
    d.identity !== null && (await botActorOf(d.members, actor.membershipId)) !== null;

  return {
    async status(actor: ActorContext): Promise<TelegramStatus> {
      const [offered, link] = await Promise.all([available(actor), d.links.find(actor.membershipId)]);
      return {
        available: offered,
        linked: link !== null,
        username: link?.username ?? null,
        linkedAt: link?.linkedAt ?? null,
        notifications: link?.notifications ?? false,
      };
    },

    async setNotifications(actor: ActorContext, on: boolean): Promise<TelegramStatus> {
      if (!(await d.links.setNotifications(actor.membershipId, on))) {
        throw new AppError("not-found", "No Telegram chat is linked");
      }
      return this.status(actor);
    },

    async issueLink(actor: ActorContext): Promise<{ url: string; expiresAt: Date }> {
      if (!d.identity || !(await available(actor))) {
        throw new AppError("not-found", "The Telegram bot is not available");
      }
      const username = await d.identity.username();
      const { token, hash } = d.tokens.issue();
      const expiresAt = new Date(d.clock.now().getTime() + LINK_TOKEN_TTL_MS);
      await d.links.issueToken(actor.membershipId, hash, expiresAt);
      return { url: linkUrl(username, token), expiresAt };
    },

    async unlink(actor: ActorContext): Promise<void> {
      await d.links.unlink(actor.membershipId);
    },

    async redeem(token: string, chat: TelegramChat): Promise<boolean> {
      if (token.length === 0) return false;
      return (await d.links.redeem(d.tokens.hash(token), d.clock.now(), chat)) !== null;
    },

    async isLinked(chatId: number): Promise<boolean> {
      return (await d.links.memberOf(chatId)) !== null;
    },
  };
}

export type TelegramLinkUseCases = ReturnType<typeof createTelegramLinkUseCases>;
