import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  isMonthly, KPI_METRICS, MANUAL_KPI, useClearKpi, useSaveKpi,
  type Kpi, type KpiInput, type KpiMetric, type KpiScope,
} from "@/entities/kpi/index.js";
import { PROJECTS_SUMMARY_KEY } from "@/entities/campaign/index.js";
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

type Choice = KpiMetric | typeof MANUAL_KPI;

type Field = "name" | "value" | "target";

const AMOUNT = /^\d{1,14}(\.\d{1,4})?$/;
const NAME_LIMIT = 100;

const decimal = (text: string) => text.trim().replace(",", ".");
const shown = (amount: string) => String(Number(amount));

export function KpiTargetDialog({ scope, kpi, onClose }: KpiTargetDialogProps) {
  const save = useSaveKpi(scope);
  const clear = useClearKpi(scope);
  const queryClient = useQueryClient();
  const { raise } = useAlerts();
  const manualKpi = kpi?.metric === MANUAL_KPI ? kpi : null;
  const [choice, setChoice] = useState<Choice>(kpi?.metric ?? "CONVERSIONS");
  const [name, setName] = useState(manualKpi?.name ?? "");
  const [value, setValue] = useState(manualKpi ? shown(manualKpi.value) : "");
  const [target, setTarget] = useState(kpi ? shown(kpi.target) : "");
  const [problems, setProblems] = useState<ReadonlySet<Field>>(new Set());
  const pending = save.isPending || clear.isPending;
  const manual = choice === MANUAL_KPI;

  const changed = () => {
    if (scope.kind === "project") void queryClient.invalidateQueries({ queryKey: PROJECTS_SUMMARY_KEY });
    onClose();
  };

  const failed = (error: unknown) =>
    raise(error instanceof ApiError && error.status < 500 ? error.message : t("kpi.saveFailed"));

  const settle = (field: Field) =>
    setProblems((current) => new Set([...current].filter((problem) => problem !== field)));

  function validated(): KpiInput | null {
    const goal = decimal(target);
    const found = new Set<Field>();
    if (!AMOUNT.test(goal) || Number(goal) <= 0) found.add("target");
    if (choice !== MANUAL_KPI) {
      setProblems(found);
      return found.size > 0 ? null : { metric: choice, target: goal };
    }
    const label = name.trim();
    const amount = decimal(value);
    if (label === "") found.add("name");
    if (!AMOUNT.test(amount)) found.add("value");
    setProblems(found);
    return found.size > 0 ? null : { metric: MANUAL_KPI, name: label, value: amount, target: goal };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = validated();
    if (!body) return;
    try {
      await save.mutateAsync(body);
      changed();
    } catch (error) {
      failed(error);
    }
  }

  async function remove() {
    try {
      await clear.mutateAsync();
      changed();
    } catch (error) {
      failed(error);
    }
  }

  const hint = manual ? t("kpi.manualHint") : isMonthly(choice) ? t("kpi.monthly") : t("kpi.asIs");

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(440px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{t("kpi.title")}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kpi-metric">{t("kpi.metric")}</Label>
            <Select value={choice} onValueChange={(next) => setChoice(next as Choice)} disabled={pending}>
              <SelectTrigger id="kpi-metric" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KPI_METRICS.map((definition) => (
                  <SelectItem key={definition.id} value={definition.id}>{t(definition.label)}</SelectItem>
                ))}
                {scope.kind === "project" ? <SelectItem value={MANUAL_KPI}>{t("kpi.manual")}</SelectItem> : null}
              </SelectContent>
            </Select>
          </div>
          {manual ? (
            <>
              <TextField
                label={t("kpi.name")}
                autoComplete="off"
                maxLength={NAME_LIMIT}
                value={name}
                disabled={pending}
                error={problems.has("name") ? t("kpi.nameRequired") : undefined}
                onChange={(event) => { setName(event.target.value); settle("name"); }}
              />
              <TextField
                label={t("kpi.value")}
                inputMode="decimal"
                autoComplete="off"
                value={value}
                disabled={pending}
                error={problems.has("value") ? t("kpi.valueInvalid") : undefined}
                onChange={(event) => { setValue(event.target.value); settle("value"); }}
              />
            </>
          ) : null}
          <TextField
            label={t("kpi.target")}
            inputMode="decimal"
            autoComplete="off"
            value={target}
            disabled={pending}
            error={problems.has("target") ? t("kpi.invalid") : undefined}
            onChange={(event) => { setTarget(event.target.value); settle("target"); }}
          />
          <p className="text-xs text-muted-foreground">{hint}</p>
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
