import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  useNotifications,
  useNotificationStream,
  useReadAllNotifications,
  useReadNotification,
  type Notification,
} from "@/entities/notification/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/index.js";
import { notificationTarget, notificationText } from "./notificationText.js";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const statusId = useId();
  const titleId = useId();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const read = useReadNotification();
  const readAll = useReadAllNotifications();
  useNotificationStream();

  const items = notifications.data?.notifications ?? [];
  const unread = (notifications.data?.unreadCount ?? 0) > 0;

  const choose = (notification: Notification) => {
    if (notification.readAt === null) read.mutate(notification.id);
    setOpen(false);
    const target = notificationTarget(notification);
    if (target) navigate(target);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("notifications.title")}
              aria-describedby={unread ? statusId : undefined}
              data-unread={unread}
              className="relative"
            >
              <BellIcon />
              {unread ? (
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-background"
                />
              ) : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("notifications.title")}</TooltipContent>
      </Tooltip>
      {unread ? <span id={statusId} className="sr-only">{t("notifications.unread")}</span> : null}

      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0" aria-labelledby={titleId}>
        <div className="flex min-h-12 items-center justify-between gap-2 border-b border-border px-4 py-2">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">{t("notifications.title")}</h2>
          {unread ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => readAll.mutate()}>
              {t("notifications.readAll")}
            </Button>
          ) : null}
        </div>

        {notifications.isSuccess && items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("notifications.empty")}</p>
        ) : null}

        {items.length > 0 ? (
          <ul aria-labelledby={titleId} className="max-h-[min(28rem,70vh)] overflow-y-auto py-1">
            {items.map((notification) => {
              const isUnread = notification.readAt === null;
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    data-unread={isUnread}
                    onClick={() => choose(notification)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
                      "hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", isUnread ? "bg-primary" : "bg-transparent")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm text-foreground", isUnread && "font-medium")}>
                        {notificationText(notification)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {[
                          notification.actor?.name,
                          formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ru }),
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {isUnread ? <span className="sr-only">{t("notifications.unreadItem")}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
