import { useState } from "react";
import { Send } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { Button, useAlerts } from "@/shared/ui/index.js";
import { useTelegramLink, useTelegramStatus, useTelegramUnlink } from "../api/queries.js";

export function TelegramBotSection() {
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const status = useTelegramStatus(linkUrl !== null);
  const link = useTelegramLink();
  const unlink = useTelegramUnlink();
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
      className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Send aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id="telegram-bot-title" className="text-sm font-semibold">{t("telegram.title")}</h3>
          {bot.linked ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t("telegram.linked")}</span>
              {bot.username && <span> @{bot.username}</span>}
              <span>. {t("telegram.linkedHint")}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {pendingUrl ? t("telegram.pending") : t("telegram.hint")}
            </p>
          )}
        </div>
      </div>
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
    </section>
  );
}
