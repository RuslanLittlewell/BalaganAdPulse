import { useRef, useState, type FormEvent } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import {
  isKpiMetric, isMonthly, KPI_METRICS, MANUAL_KPI, MAX_PROJECT_KPIS, TYPED_KPI_METRICS, useSaveProjectKpis,
  type KpiFigures, type KpiMetric, type ProjectKpi, type ProjectKpiInput,
} from "@/entities/kpi/index.js";
import {
  isResultType, orderedResultTypes, PROJECTS_SUMMARY_KEY, resultTypeCostLabel, resultTypeLabel, useProjectCampaigns,
  type ResultType,
} from "@/entities/campaign/index.js";
import { useQueryClient } from "@tanstack/react-query";
import { t } from "@/shared/config/index.js";
import { ApiError, cn, type Currency } from "@/shared/lib/index.js";
import {
  Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TextField, useAlerts,
} from "@/shared/ui/index.js";
import { Switch } from "@/shared/ui/ui/switch.js";
import { KpiCard } from "./KpiCard.js";
import { AMOUNT, decimal, NAME_LIMIT, shown } from "./kpiForm.js";

export interface ProjectKpiDialogProps {
  projectId: string;
  kpis: readonly ProjectKpi[];
  figures: KpiFigures;
  range: { from: string; to: string };
  currency: Currency;
  currencyFigures?: { currency: Currency; performance: KpiFigures }[];
  onClose: () => void;
}

const noop = () => {};

type Choice = string;

const typedChoice = (metric: KpiMetric, type: string) => `${metric}:${type}`;

function measuredOf(choice: Choice): { metric: KpiMetric; resultType?: string } {
  const [metric, resultType] = choice.split(":");
  const measured = isKpiMetric(metric ?? "") ? metric as KpiMetric : "CONVERSIONS";
  return resultType ? { metric: measured, resultType } : { metric: measured };
}

function typedTitle(metric: KpiMetric, type: ResultType): string {
  return metric === "RESULTS" ? resultTypeLabel(type) : resultTypeCostLabel(type);
}

type Field = "name" | "value" | "target";

interface Draft {
  key: number;
  choice: Choice;
  name: string;
  value: string;
  target: string;
  enabled: boolean;
}

const blank = (key: number): Draft => ({ key, choice: "CONVERSIONS", name: "", value: "", target: "", enabled: true });

const isBlank = (draft: Draft) => draft.target.trim() === "" && draft.name.trim() === "" && draft.value.trim() === "";

function draftOf(kpi: ProjectKpi, key: number): Draft {
  return kpi.metric === MANUAL_KPI
    ? { key, choice: MANUAL_KPI, name: kpi.name, value: shown(kpi.value), target: shown(kpi.target), enabled: kpi.enabled }
    : {
      key,
      choice: kpi.resultType ? typedChoice(kpi.metric, kpi.resultType) : kpi.metric,
      name: "",
      value: "",
      target: shown(kpi.target),
      enabled: kpi.enabled,
    };
}

function validated(draft: Draft): { input: ProjectKpiInput } | { problems: Field[] } {
  const problems: Field[] = [];
  const target = decimal(draft.target);
  if (!AMOUNT.test(target) || Number(target) <= 0) problems.push("target");
  if (draft.choice !== MANUAL_KPI) {
    return problems.length > 0
      ? { problems }
      : { input: { ...measuredOf(draft.choice), target, enabled: draft.enabled } };
  }
  const name = draft.name.trim();
  const value = decimal(draft.value);
  if (name === "") problems.push("name");
  if (!AMOUNT.test(value)) problems.push("value");
  return problems.length > 0
    ? { problems }
    : { input: { metric: MANUAL_KPI, name, value, target, enabled: draft.enabled } };
}

function KpiBlock({
  draft,
  position,
  problems,
  disabled,
  preview,
  resultTypes,
  onChange,
  onRemove,
}: {
  draft: Draft;
  resultTypes: readonly ResultType[];
  position: number;
  problems: ReadonlySet<Field>;
  disabled: boolean;
  preview: Pick<ProjectKpiDialogProps, "figures" | "range" | "currency" | "currencyFigures">;
  onChange: (changes: Partial<Draft>) => void;
  onRemove?: () => void;
}) {
  const manual = draft.choice === MANUAL_KPI;
  const empty = isBlank(draft);
  const result = empty ? null : validated(draft);
  const hint = draft.choice === MANUAL_KPI
    ? t("kpi.manualHint")
    : isMonthly(measuredOf(draft.choice).metric) ? t("kpi.monthly") : t("kpi.asIs");
  const metricId = `kpi-metric-${draft.key}`;

  return (
    <div
      role="group"
      aria-label={`KPI ${position}`}
      data-enabled={draft.enabled}
      className={cn(
        "relative grid gap-4 rounded-xl border p-3 sm:grid-cols-[210px_minmax(0,1fr)]",
        empty ? "border-dashed bg-muted/10" : "border-border",
      )}
    >
      <div className="min-w-0">
        <KpiCard
          {...preview}
          testId="kpi-preview"
          kpi={result && "input" in result ? result.input : null}
          enabled={draft.enabled}
          pending={false}
          controls={false}
          onEdit={noop}
        />
      </div>
      <div className="grid min-w-0 content-start gap-3">
        <div className="flex items-center justify-between gap-3 pr-8">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {empty ? t("kpi.new") : `KPI ${position}`}
          </span>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={draft.enabled}
              disabled={disabled}
              aria-label={t("kpi.counts")}
              onCheckedChange={(enabled) => onChange({ enabled })}
            />
            {t("kpi.counts")}
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={metricId}>{t("kpi.metric")}</Label>
          <Select value={draft.choice} onValueChange={(next) => onChange({ choice: next as Choice })} disabled={disabled}>
            <SelectTrigger id={metricId} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KPI_METRICS.map((definition) => (
                <SelectItem key={definition.id} value={definition.id}>{t(definition.label)}</SelectItem>
              ))}
              {resultTypes.flatMap((type) => TYPED_KPI_METRICS.map((metric) => (
                <SelectItem key={typedChoice(metric, type)} value={typedChoice(metric, type)}>
                  {typedTitle(metric, type)}
                </SelectItem>
              )))}
              <SelectItem value={MANUAL_KPI}>{t("kpi.manual")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {manual ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label={t("kpi.name")}
              autoComplete="off"
              maxLength={NAME_LIMIT}
              value={draft.name}
              disabled={disabled}
              error={problems.has("name") ? t("kpi.nameRequired") : undefined}
              onChange={(event) => onChange({ name: event.target.value })}
            />
            <TextField
              label={t("kpi.value")}
              inputMode="decimal"
              autoComplete="off"
              value={draft.value}
              disabled={disabled}
              error={problems.has("value") ? t("kpi.valueInvalid") : undefined}
              onChange={(event) => onChange({ value: event.target.value })}
            />
          </div>
        ) : null}
        <TextField
          label={t("kpi.target")}
          inputMode="decimal"
          autoComplete="off"
          value={draft.target}
          disabled={disabled}
          error={problems.has("target") ? t("kpi.invalid") : undefined}
          onChange={(event) => onChange({ target: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-2 top-2 size-7 rounded-full text-destructive hover:bg-destructive/15 hover:text-destructive"
          disabled={disabled}
          aria-label={`${t("kpi.remove")} ${position}`}
          onClick={onRemove}
        >
          <XIcon aria-hidden className="size-5" strokeWidth={2.5} />
        </Button>
      ) : null}
    </div>
  );
}

export function ProjectKpiDialog({ projectId, kpis, onClose, ...preview }: ProjectKpiDialogProps) {
  const save = useSaveProjectKpis(projectId);
  const queryClient = useQueryClient();
  const { raise } = useAlerts();
  const keys = useRef(kpis.length + 1);
  const freshKey = () => keys.current++;
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    kpis.length > 0 ? kpis.map((kpi, index) => draftOf(kpi, index)) : [blank(0)]);
  const [problems, setProblems] = useState<ReadonlyMap<number, ReadonlySet<Field>>>(new Map());
  const pending = save.isPending;
  const campaigns = useProjectCampaigns(projectId, preview.range);
  const resultTypes = orderedResultTypes([
    ...(campaigns.data ?? []).flatMap((campaign) => campaign.resultTypes),
    ...kpis.flatMap((kpi) => (kpi.metric !== MANUAL_KPI && isResultType(kpi.resultType) ? [kpi.resultType] : [])),
  ]).filter((type) => type !== "UNKNOWN");

  const update = (key: number, changes: Partial<Draft>) => {
    setProblems((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)));
  };

  const add = () => setDrafts((current) => [...current, blank(freshKey())]);

  const remove = (key: number) => {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = new Map<number, ReadonlySet<Field>>();
    const inputs: ProjectKpiInput[] = [];
    for (const draft of drafts) {
      if (isBlank(draft)) continue;
      const result = validated(draft);
      if ("input" in result) inputs.push(result.input);
      else found.set(draft.key, new Set(result.problems));
    }
    setProblems(found);
    if (found.size > 0) return;
    try {
      await save.mutateAsync(inputs);
      void queryClient.invalidateQueries({ queryKey: PROJECTS_SUMMARY_KEY });
      onClose();
    } catch (error) {
      raise(error instanceof ApiError && error.status < 500 ? error.message : t("kpi.saveFailed"));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] w-[min(760px,calc(100vw-2rem))] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("kpi.title")}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          {drafts.map((draft, index) => (
            <KpiBlock
              key={draft.key}
              draft={draft}
              position={index + 1}
              problems={problems.get(draft.key) ?? new Set()}
              disabled={pending}
              preview={preview}
              resultTypes={resultTypes}
              onChange={(changes) => update(draft.key, changes)}
              onRemove={isBlank(draft) ? undefined : () => remove(draft.key)}
            />
          ))}
          {drafts.length < MAX_PROJECT_KPIS ? (
            <Button
              type="button"
              variant="outline"
              className="border-dashed"
              disabled={pending || (drafts.length > 0 && isBlank(drafts[drafts.length - 1]!))}
              onClick={add}
            >
              <PlusIcon aria-hidden /> {t("kpi.add")}
            </Button>
          ) : null}
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
            <Button type="submit" disabled={pending}>{t("action.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
