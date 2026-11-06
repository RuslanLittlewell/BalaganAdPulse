import { LIMITED_RESOURCES } from "@adpulse/access-policy";
import { useAuth } from "@/features/auth/index.js";
import {
  resourceLabel,
  tariffAudience,
  tariffName,
  tariffPrice,
  usageLabel,
} from "@/entities/tariff/index.js";
import { t } from "@/shared/config/index.js";
import { formatCalendarDate } from "@/shared/lib/index.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/index.js";

export interface TariffDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TariffDialog({ open, onClose }: TariffDialogProps) {
  const { tariff } = useAuth();
  if (!tariff) return null;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>
            {t("tariff.title")}: {tariffName(tariff.tariff)}
            <span className="ml-2 font-normal text-muted-foreground">{tariffPrice(tariff.tariff)}</span>
          </DialogTitle>
          <DialogDescription>{tariffAudience(tariff.tariff)}</DialogDescription>
        </DialogHeader>
        {tariff.trialEndsAt && (
          <p className="text-sm">
            {tariffName("TRIAL")} {t("tariff.trial.until")} {formatCalendarDate(tariff.trialEndsAt)}
          </p>
        )}
        <section aria-label={t("tariff.usage")} className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">{t("tariff.usage")}</h3>
          <dl className="flex flex-col gap-3">
            {LIMITED_RESOURCES.map((resource) => {
              const used = tariff.usage[resource];
              const limit = tariff.limits[resource];
              const full = limit !== null && used >= limit;
              return (
                <div key={resource} data-resource={resource} data-full={full} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <dt>{resourceLabel(resource)}</dt>
                    <dd className={full ? "font-medium text-destructive tabular-nums" : "tabular-nums"}>
                      {usageLabel(used, limit)}
                    </dd>
                  </div>
                  {limit !== null && (
                    <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={full ? "h-full bg-destructive" : "h-full bg-primary"}
                        style={{ width: `${Math.min(100, limit === 0 ? 100 : (used / limit) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </dl>
        </section>
        <p className="text-xs text-muted-foreground">{t("tariff.change")}</p>
      </DialogContent>
    </Dialog>
  );
}
