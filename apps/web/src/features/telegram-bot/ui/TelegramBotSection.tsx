import { useState } from "react";
import { t } from "@/shared/config/index.js";
import { Button, Switch, useAlerts } from "@/shared/ui/index.js";
import { useTelegramLink, useTelegramNotifications, useTelegramStatus, useTelegramUnlink } from "../api/queries.js";

export function TelegramBotSection() {
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const status = useTelegramStatus(linkUrl !== null);
  const link = useTelegramLink();
  const unlink = useTelegramUnlink();
  const notify = useTelegramNotifications();
  const { raise } = useAlerts();

  const bot = status.data;
  if (!bot?.available) return null;
  const pendingUrl = bot.linked ? null : linkUrl;

  const connect = () => {
    link.mutate(undefined, {
      onSuccess: ({ url }) => setLinkUrl(url),
      onError: () => raise(t("telegram.linkFailed")),
    });
  };

  const disconnect = () => {
    setLinkUrl(null);
    unlink.mutate(undefined, { onError: () => raise(t("telegram.unlinkFailed")) });
  };

  return (
    <section
      aria-labelledby="telegram-bot-title"
      data-linked={bot.linked}
      className="flex min-w-0 flex-col gap-2"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span id="telegram-bot-title" className="shrink-0 text-sm font-normal text-foreground">{t("telegram.title")}</span>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {bot.linked ? (
            <>
              <p role="status" className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="sr-only">{t("telegram.linked")}</span>
                {bot.username && <span className="max-w-20 truncate sm:max-w-40">@{bot.username}</span>}
              </p>
              <Switch
                aria-label={t("telegram.notifications")}
                checked={bot.notifications}
                disabled={notify.isPending}
                onCheckedChange={(on) =>
                  notify.mutate(on, { onError: () => raise(t("telegram.notificationsFailed")) })}
              />
            </>
          ) : null}
          {bot.linked ? (
            <Button type="button" variant="outline" size="sm" disabled={unlink.isPending} onClick={disconnect}>
              {t("telegram.disconnect")}
            </Button>
          ) : pendingUrl ? (
            <Button asChild size="sm">
              <a href={pendingUrl} target="_blank" rel="noreferrer">{t("telegram.open")}</a>
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={link.isPending} onClick={connect}>
              {t("telegram.connect")}
            </Button>
          )}
        </div>
      </div>
      {!bot.linked && (
        <p className="text-xs text-muted-foreground">
          {pendingUrl ? t("telegram.pending") : t("telegram.hint")}
        </p>
      )}
    </section>
  );
}
