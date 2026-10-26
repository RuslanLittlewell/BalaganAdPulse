import type { AddressedNotification } from "#modules/notifications/index.js";
import type { BotApi, BotReply } from "./bot-api.js";
import type { TelegramLinks } from "./ports.js";

export interface TelegramNotificationRelayDependencies {
  readonly links: Pick<TelegramLinks, "chatFor">;
  readonly api: Pick<BotApi, "sendMessage">;
  readonly render: (notification: AddressedNotification) => BotReply;
}

export function createTelegramNotificationRelay(d: TelegramNotificationRelayDependencies) {
  return {
    async forward(notifications: readonly AddressedNotification[]): Promise<void> {
      const failures: unknown[] = [];
      for (const notification of notifications) {
        try {
          const chatId = await d.links.chatFor(notification.recipientId);
          if (chatId !== null) await d.api.sendMessage(chatId, d.render(notification));
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length > 0) {
        throw new AggregateError(failures, `${failures.length} of ${notifications.length} notifications did not reach Telegram`);
      }
    },
  };
}

export type TelegramNotificationRelay = ReturnType<typeof createTelegramNotificationRelay>;
