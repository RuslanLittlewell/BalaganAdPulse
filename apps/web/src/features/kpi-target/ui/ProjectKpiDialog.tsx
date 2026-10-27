import { useRef, useState, type FormEvent } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import {
  isMonthly, kpiInputOf, MANUAL_KPI, MAX_PROJECT_KPIS, useSaveProjectKpis,
  type KpiAccount, type KpiFigures, type ProjectKpi, type ProjectKpiInput,
} from "@/entities/kpi/index.js";
import {
  isResultType, orderedResultTypes, PROJECTS_SUMMARY_KEY, useProjectCampaigns, type ResultType,
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
import { choiceOf, MeasuredChoices, measuredOf, type Choice } from "./kpiChoice.js";
import { partHolds, type ProjectKpiPart } from "./kpiPart.js";

export interface ProjectKpiDialogProps {
  projectId: string;
  kpis: readonly ProjectKpi[];
  figures: KpiFigures;
  range: { from: string; to: string };
  currency: Currency;
  currencyFigures?: { currency: Currency; performance: KpiFigures }[];
  part?: ProjectKpiPart;
  onClose: () => void;
}

const noop = () => {};

type Field = "name" | "value" | "target";

interface Draft {
  key: number;
  choice: Choice;
  name: string;
  value: string;
  target: string;
  enabled: boolean;
  account: KpiAccount | null;
}

const blank = (key: number, account: KpiAccount | null): Draft =>
  ({ key, choice: "CONVERSIONS", name: "", value: "", target: "", enabled: true, account });

const isBlank = (draft: Draft) => draft.target.trim() === "" && draft.name.trim() === "" && draft.value.trim() === "";

function draftOf(kpi: ProjectKpi, key: number): Draft {
  const kept = { key, target: shown(kpi.target), enabled: kpi.enabled, account: kpi.account };
  return kpi.metric === MANUAL_KPI
    ? { ...kept, choice: MANUAL_KPI, name: kpi.name, value: shown(kpi.value) }
    : { ...kept, choice: choiceOf(kpi), name: "", value: "" };
}

function storedInput(kpi: ProjectKpi): ProjectKpiInput[] {
  const input = kpiInputOf(kpi);
  return input ? [{ ...input, enabled: kpi.enabled, account: kpi.account }] : [];
}

function validated(draft: Draft): { input: ProjectKpiInput } | { problems: Field[] } {
  const problems: Field[] = [];
  const target = decimal(draft.target);
  if (!AMOUNT.test(target) || Number(target) <= 0) problems.push("target");
  if (draft.choice !== MANUAL_KPI) {
    return problems.length > 0
      ? { problems }
      : { input: { ...measuredOf(draft.choice), target, enabled: draft.enabled, account: draft.account } };
  }
  const name = draft.name.trim();
  const value = decimal(draft.value);
  if (name === "") problems.push("name");
  if (!AMOUNT.test(value)) problems.push("value");
  return problems.length > 0
    ? { problems }
    : { input: { metric: MANUAL_KPI, name, value, target, enabled: draft.enabled, account: draft.account } };
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
              <MeasuredChoices resultTypes={resultTypes} />
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

export function ProjectKpiDialog({
  projectId, kpis, part = { kind: "all", account: null }, onClose, ...preview
}: ProjectKpiDialogProps) {
  const save = useSaveProjectKpis(projectId);
  const queryClient = useQueryClient();
  const { raise } = useAlerts();
  const editable = kpis.filter((kpi) => partHolds(part, kpi));
  const keys = useRef(kpis.length + 1);
  const freshKey = () => keys.current++;
  const newAccount = part.account;
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    editable.length > 0 ? editable.map((kpi, index) => draftOf(kpi, index)) : [blank(0, newAccount)]);
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

  const add = () => setDrafts((current) => [...current, blank(freshKey(), newAccount)]);

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
      await save.mutateAsync([...inputs, ...kpis.filter((kpi) => !partHolds(part, kpi)).flatMap(storedInput)]);
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
