import { useState, type FormEvent } from "react";
import {
  isMonthly, MANUAL_KPI, useClearKpi, useSaveKpi,
  type Kpi, type KpiInput, type SingleKpiScope,
} from "@/entities/kpi/index.js";
import {
  isResultType, orderedResultTypes, useCampaign, useRefreshCampaign,
} from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { AMOUNT, decimal, shown } from "./kpiForm.js";
import { choiceOf, MeasuredChoices, measuredOf, type Choice } from "./kpiChoice.js";
import {
  Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label,
  Select, SelectContent, SelectTrigger, SelectValue, TextField, useAlerts,
} from "@/shared/ui/index.js";

export interface KpiTargetDialogProps {
  scope: SingleKpiScope;
  kpi: Kpi | null;
  range: { from: string; to: string };
  onClose: () => void;
}

type Field = "target";

function useOfferedTypes(scope: SingleKpiScope, kpi: Kpi | null, range: { from: string; to: string }) {
  const campaign = useCampaign(scope.kind === "campaign" ? scope.id : undefined, range);
  if (scope.kind !== "campaign") return [];
  const saved = kpi && kpi.metric !== MANUAL_KPI && isResultType(kpi.resultType) ? [kpi.resultType] : [];
  return orderedResultTypes([...(campaign.data?.resultTypes ?? []), ...saved]).filter((type) => type !== "UNKNOWN");
}

export function KpiTargetDialog({ scope, kpi, range, onClose }: KpiTargetDialogProps) {
  const save = useSaveKpi(scope);
  const clear = useClearKpi(scope);
  const refreshCampaign = useRefreshCampaign();
  const { raise } = useAlerts();
  const resultTypes = useOfferedTypes(scope, kpi, range);
  const [choice, setChoice] = useState<Choice>(kpi && kpi.metric !== MANUAL_KPI ? choiceOf(kpi) : "CONVERSIONS");
  const [target, setTarget] = useState(kpi ? shown(kpi.target) : "");
  const [problems, setProblems] = useState<ReadonlySet<Field>>(new Set());
  const pending = save.isPending || clear.isPending;
  const { metric } = measuredOf(choice);

  const saved = () => {
    if (scope.kind === "campaign") void refreshCampaign(scope.id);
    onClose();
  };

  const failed = (error: unknown) =>
    raise(error instanceof ApiError && error.status < 500 ? error.message : t("kpi.saveFailed"));

  function validated(): KpiInput | null {
    const goal = decimal(target);
    if (!AMOUNT.test(goal) || Number(goal) <= 0) {
      setProblems(new Set<Field>(["target"]));
      return null;
    }
    setProblems(new Set());
    return { ...measuredOf(choice), target: goal };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = validated();
    if (!body) return;
    try {
      await save.mutateAsync(body);
      saved();
    } catch (error) {
      failed(error);
    }
  }

  async function remove() {
    try {
      await clear.mutateAsync();
      saved();
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
            <Select value={choice} onValueChange={setChoice} disabled={pending}>
              <SelectTrigger id="kpi-metric" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <MeasuredChoices resultTypes={resultTypes} />
              </SelectContent>
            </Select>
          </div>
          <TextField
            label={t("kpi.target")}
            inputMode="decimal"
            autoComplete="off"
            value={target}
            disabled={pending}
            error={problems.has("target") ? t("kpi.invalid") : undefined}
            onChange={(event) => { setTarget(event.target.value); setProblems(new Set()); }}
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
