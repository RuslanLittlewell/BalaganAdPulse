import { formatCount, formatCurrency, formatMultiple } from "@/shared/lib/index.js";
import { channelLabel, useChannelShares, type DateRange } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";

export function ChannelPanel({ range }: { range: DateRange }) {
  const channels = useChannelShares(range);
  const total = (channels.data ?? []).reduce((sum, share) => sum + share.performance.spend, 0);

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold text-foreground">{t("dashboard.sources")}</h2>
      {channels.isSuccess && channels.data.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">{t("dashboard.sources.empty")}</p>
      )}
      <ul className="mt-4 space-y-3">
        {(channels.data ?? []).map((share) => (
          <li key={share.channel}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">{channelLabel(share.channel)}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatCurrency(share.performance.spend)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: total === 0 ? "0%" : `${(share.performance.spend / total) * 100}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("dashboard.sources.campaigns")}: {formatCount(share.campaigns)}
              {" · ROAS "}{formatMultiple(share.performance.roas)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
