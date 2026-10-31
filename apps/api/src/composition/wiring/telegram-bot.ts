import { config, type TelegramBotConfig } from "#shared/infrastructure/config.js";
import { prisma } from "#shared/infrastructure/prisma.js";
import type { NotificationRelay } from "#modules/notifications/index.js";
import type { CampaignUseCases } from "#modules/campaigns/index.js";
import type { ClientRecord } from "#modules/clients/index.js";
import type { ActorContext } from "#shared/application/index.js";
import {
  BOT_COPY,
  createSummaryUseCases,
  createTaskDraftUseCases,
  createTelegramBot,
  createTelegramLinkUseCases,
  createTelegramNotificationRelay,
  createTelegramRouter,
  createUpdatePoller,
  notificationMessage,
  type DayRange,
  type SummaryReads,
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
import { runDetached, type Kernel } from "./kernel.js";

export interface TelegramPoller {
  start(): void;
  stop(): Promise<void>;
}

const IDLE_POLLER: TelegramPoller = { start: () => undefined, stop: async () => undefined };

export interface SummarySources {
  readonly projects: {
    listReachable(actor: ActorContext): Promise<readonly {
      id: string; clientId: string; name: string; budgetCurrency: string | null; kpiTracked: boolean;
    }[]>;
  };
  readonly clients: { listReachable(actor: ActorContext): Promise<readonly Pick<ClientRecord, "id" | "name">[]> };
  readonly campaigns: Pick<CampaignUseCases, "projectsSummary" | "agencySummary">;
}

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dates = (range: DayRange) => ({ from: day(range.from), to: day(range.to) });

export function summaryReads(sources: SummarySources): SummaryReads {
  return {
    async projects(actor) {
      const [projects, clients] = await Promise.all([
        sources.projects.listReachable(actor),
        sources.clients.listReachable(actor),
      ]);
      const clientNames = new Map(clients.map((client) => [client.id, client.name]));
      return projects.map((project) => ({
        id: project.id,
        name: project.name,
        clientName: clientNames.get(project.clientId) ?? null,
        currency: project.budgetCurrency,
        kpiTracked: project.kpiTracked,
      }));
    },
    projectFigures: (actor, range) => sources.campaigns.projectsSummary(actor, dates(range)),
    agencyFigures: (actor, range) => sources.campaigns.agencySummary(actor, dates(range)),
  };
}

export function wireTelegramNotifications(
  settings: TelegramBotConfig | null = config.telegramBot,
): NotificationRelay | undefined {
  if (!settings) return undefined;
  const relay = createTelegramNotificationRelay({
    links: new PrismaTelegramLinks(prisma),
    api: new TelegramClient(settings.botToken),
    render: (notification) => notificationMessage(notification, config.appUrl),
  });
  return {
    forward: (notifications) =>
      runDetached("Failed to forward notifications to Telegram:", relay.forward(notifications)),
  };
}

export function wireTelegramBot(
  { clock, ids }: Kernel,
  { tasks, summaries }: { tasks: TaskCreation; summaries: SummarySources },
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
  const summaryUseCases = createSummaryUseCases({
    links, members, reads: summaryReads(summaries), clock, timeZone: config.taskTimeZone,
  });
  const bot = createTelegramBot({
    api: telegram, links: linkUseCases, drafts, summaries: summaryUseCases, appUrl: config.appUrl,
  });
  return {
    telegramRouter,
    telegramPoller: createUpdatePoller({
      api: telegram, handle: bot.handle, prepare: () => telegram.setCommands(BOT_COPY.commands),
    }),
  };
}

export type TelegramBotWiring = ReturnType<typeof wireTelegramBot>;
