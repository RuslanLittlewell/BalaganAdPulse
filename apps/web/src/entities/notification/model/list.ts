import type { Notification, NotificationList } from "../api/api.js";

export const LATEST_NOTIFICATIONS = 50;

export function withArrived(list: NotificationList, arrived: Notification): NotificationList {
  const held = list.notifications.find((notification) => notification.id === arrived.id);
  const counted = held !== undefined && held.readAt === null;
  return {
    notifications: [arrived, ...list.notifications.filter((notification) => notification.id !== arrived.id)]
      .slice(0, LATEST_NOTIFICATIONS),
    unreadCount: list.unreadCount + (arrived.readAt === null && !counted ? 1 : 0),
  };
}

export function withOneRead(list: NotificationList, id: string, at: string): NotificationList {
  const target = list.notifications.find((notification) => notification.id === id);
  if (!target || target.readAt !== null) return list;
  return {
    notifications: list.notifications.map((notification) =>
      notification.id === id ? { ...notification, readAt: at } : notification),
    unreadCount: Math.max(0, list.unreadCount - 1),
  };
}

export function withAllRead(list: NotificationList, at: string): NotificationList {
  return {
    notifications: list.notifications.map((notification) =>
      notification.readAt === null ? { ...notification, readAt: at } : notification),
    unreadCount: 0,
  };
}
