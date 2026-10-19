import type { AddressedNotification, NotificationView } from "../domain/notification.js";

export interface NotificationSubscriber {
  deliver(notification: NotificationView): void;
  end(): void;
}

export interface NotificationHub {
  subscribe(recipientId: string, subscriber: NotificationSubscriber): () => void;
  publish(notification: AddressedNotification): void;
  size(): number;
  closeAll(): void;
}

export function createNotificationHub(): NotificationHub {
  const byRecipient = new Map<string, Set<NotificationSubscriber>>();
  return {
    subscribe(recipientId, subscriber) {
      const subscribers = byRecipient.get(recipientId) ?? new Set<NotificationSubscriber>();
      subscribers.add(subscriber);
      byRecipient.set(recipientId, subscribers);
      return () => {
        subscribers.delete(subscriber);
        if (subscribers.size === 0 && byRecipient.get(recipientId) === subscribers) byRecipient.delete(recipientId);
      };
    },
    publish({ recipientId, ...notification }) {
      for (const subscriber of byRecipient.get(recipientId) ?? []) {
        try {
          subscriber.deliver(notification);
        } catch {
        }
      }
    },
    size: () => [...byRecipient.values()].reduce((total, subscribers) => total + subscribers.size, 0),
    closeAll() {
      const everyone = [...byRecipient.values()].flatMap((subscribers) => [...subscribers]);
      byRecipient.clear();
      for (const subscriber of everyone) subscriber.end();
    },
  };
}
