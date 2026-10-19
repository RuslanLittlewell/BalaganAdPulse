import { config, type TelegramBotConfig } from "#shared/infrastructure/config.js";
import { prisma } from "#shared/infrastructure/prisma.js";
import {
  createTaskDraftUseCases,
  createTelegramBot,
  createTelegramLinkUseCases,
  createTelegramRouter,
  createUpdatePoller,
  type TaskCreation,
} from "#modules/telegram-bot/index.js";
import { GroqSpeechToText, GroqTaskReader } from "#modules/telegram-bot/infrastructure/groq.js";
import {
  PrismaTaskCatalogs,
  PrismaTaskDrafts,
  PrismaTelegramLinks,
  PrismaTelegramMembers,
  RandomLinkTokens,
} from "#modules/telegram-bot/infrastructure/prisma-telegram.js";
import { TelegramClient } from "#modules/telegram-bot/infrastructure/telegram-client.js";
import type { Kernel } from "./kernel.js";

export interface TelegramPoller {
  start(): void;
  stop(): Promise<void>;
}

const IDLE_POLLER: TelegramPoller = { start: () => undefined, stop: async () => undefined };

export function wireTelegramBot(
  { clock, ids }: Kernel,
  { tasks }: { tasks: TaskCreation },
  settings: TelegramBotConfig | null = config.telegramBot,
) {
  const links = new PrismaTelegramLinks(prisma);
  const members = new PrismaTelegramMembers(prisma);
  const telegram = settings ? new TelegramClient(settings.botToken) : null;
  const linkUseCases = createTelegramLinkUseCases({
    links, members, tokens: new RandomLinkTokens(), identity: telegram, clock,
  });
  const telegramRouter = createTelegramRouter(linkUseCases);
  if (!settings || !telegram) return { telegramRouter, telegramPoller: IDLE_POLLER };

  const drafts = createTaskDraftUseCases({
    links,
    members,
    catalogs: new PrismaTaskCatalogs(prisma),
    voices: telegram,
    speech: new GroqSpeechToText({
      apiKey: settings.groqApiKey, baseUrl: settings.groqBaseUrl, model: settings.transcriptionModel,
    }),
    reader: new GroqTaskReader({
      apiKey: settings.groqApiKey, baseUrl: settings.groqBaseUrl, model: settings.taskModel,
    }),
    drafts: new PrismaTaskDrafts(prisma),
    tasks,
    ids,
    clock,
    timeZone: config.taskTimeZone,
  });
  const bot = createTelegramBot({ api: telegram, links: linkUseCases, drafts, appUrl: config.appUrl });
  return { telegramRouter, telegramPoller: createUpdatePoller({ api: telegram, handle: bot.handle }) };
}

export type TelegramBotWiring = ReturnType<typeof wireTelegramBot>;
