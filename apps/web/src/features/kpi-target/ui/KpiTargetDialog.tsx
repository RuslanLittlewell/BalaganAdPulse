import { useState, type FormEvent } from "react";
import {
  isMonthly, KPI_METRICS, useClearKpi, useSaveKpi, type Kpi, type KpiMetric, type KpiScope,
} from "@/entities/kpi/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import {
  Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TextField, useAlerts,
} from "@/shared/ui/index.js";

export interface KpiTargetDialogProps {
  scope: KpiScope;
  kpi: Kpi | null;
  onClose: () => void;
}

const TARGET = /^\d{1,14}(\.\d{1,4})?$/;

export function KpiTargetDialog({ scope, kpi, onClose }: KpiTargetDialogProps) {
  const save = useSaveKpi(scope);
  const clear = useClearKpi(scope);
  const { raise } = useAlerts();
  const [metric, setMetric] = useState<KpiMetric>(kpi?.metric ?? "CONVERSIONS");
  const [target, setTarget] = useState(kpi ? String(Number(kpi.target)) : "");
  const [invalid, setInvalid] = useState(false);
  const pending = save.isPending || clear.isPending;

  const failed = (error: unknown) =>
    raise(error instanceof ApiError && error.status < 500 ? error.message : t("kpi.saveFailed"));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = target.trim().replace(",", ".");
    if (!TARGET.test(normalized) || Number(normalized) <= 0) {
      setInvalid(true);
      return;
    }
    try {
      await save.mutateAsync({ metric, target: normalized });
      onClose();
    } catch (error) {
      failed(error);
    }
  }

  async function remove() {
    try {
      await clear.mutateAsync();
      onClose();
    } catch (error) {
      failed(error);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(440px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{t("kpi.title")}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kpi-metric">{t("kpi.metric")}</Label>
            <Select value={metric} onValueChange={(next) => setMetric(next as KpiMetric)} disabled={pending}>
              <SelectTrigger id="kpi-metric" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KPI_METRICS.map((definition) => (
                  <SelectItem key={definition.id} value={definition.id}>{t(definition.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TextField
            label={t("kpi.target")}
            inputMode="decimal"
            autoComplete="off"
            value={target}
            disabled={pending}
            error={invalid ? t("kpi.invalid") : undefined}
            onChange={(event) => { setTarget(event.target.value); setInvalid(false); }}
          />
          <p className="text-xs text-muted-foreground">{isMonthly(metric) ? t("kpi.monthly") : t("kpi.asIs")}</p>
          <DialogFooter className="flex-wrap gap-2">
            {kpi ? (
              <Button type="button" variant="destructive" disabled={pending} onClick={() => void remove()}>
                {t("kpi.clear")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
            <Button type="submit" disabled={pending}>{t("action.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
