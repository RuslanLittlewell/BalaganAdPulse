import { useEffect, useMemo, useState, type FormEvent } from "react";
import { UploadIcon } from "lucide-react";
import { useCampaignReferences } from "@/entities/campaign/index.js";
import { leadColumnLabel, useLeadColumns, type LeadColumn } from "@/entities/lead/index.js";
import { useCan } from "@/features/permissions/index.js";
import { t, type MessageKey } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, Dropzone, Input, Label, Loader,
  SearchableSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/index.js";
import { useLeadImport, type ImportOutcome, type ImportPreview, type ImportTable } from "../api/api.js";
import { assignRole, COLUMN_ROLES, proposeRoles, questionOf, rowsOf, sampleOf, type ColumnRole } from "../lib/columnRoles.js";
import { readCsv } from "../lib/decode.js";

const FILE_LIMIT = 10 * 1024 * 1024;
const CSV_TYPES = [".csv", "text/csv"] as const;
const NO_CAMPAIGN = "none";
const FIRST_COLUMN = "NEW";
const REFUSALS = ["NOT_A_SHEET", "CLOSED", "UNREACHABLE", "EMPTY", "TOO_MANY_ROWS", "TOO_LARGE"] as const;
type Refusal = (typeof REFUSALS)[number];

function failureOf(error: unknown): string {
  const code = error instanceof ApiError ? (error.details[0] as { code?: unknown } | undefined)?.code : undefined;
  return REFUSALS.includes(code as Refusal) ? t(`leadImport.error.${code as Refusal}`) : t("leadImport.error.failed");
}

export interface LeadImportButtonProps {
  boardKey: string;
}

export function LeadImportButton({ boardKey }: LeadImportButtonProps) {
  const allowed = useCan("create", "lead-import");
  const [open, setOpen] = useState(false);
  if (!allowed) return null;
  return (
    <>
      <Button type="button" variant="outline" className="h-8" onClick={() => setOpen(true)}>
        <UploadIcon aria-hidden className="size-3" />
        {t("leadImport.open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[90vh] w-[min(720px,calc(100vw-2rem))] max-w-none overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{t("leadImport.title")}</DialogTitle>
          </DialogHeader>
          {open ? <div className="min-w-0"><ImportFlow key={boardKey} boardKey={boardKey} onDone={() => setOpen(false)} /></div> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImportFlow({ boardKey, onDone }: { boardKey: string; onDone: () => void }) {
  const imports = useLeadImport(boardKey);
  const [table, setTable] = useState<ImportTable | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function load(read: () => Promise<ImportTable>) {
    setProblem(null);
    try {
      setTable(await read());
    } catch (error) {
      setProblem(failureOf(error));
    }
  }

  if (outcome) return <ImportResult outcome={outcome} onDone={onDone} />;
  if (!table) {
    return (
      <SourceStep
        pending={imports.table.isPending}
        problem={problem}
        onLink={(url) => void load(() => imports.table.mutateAsync({ url }))}
        onFile={(file) => {
          if (file.size > FILE_LIMIT) {
            setProblem(t("leadImport.error.TOO_LARGE"));
            return;
          }
          void load(async () => imports.table.mutateAsync({ csv: await readCsv(file) }));
        }}
      />
    );
  }
  return <ColumnsStep boardKey={boardKey} table={table} onBack={() => setTable(null)} onImported={setOutcome} />;
}

function SourceStep({ pending, problem, onLink, onFile }: { pending: boolean; problem: string | null; onLink: (url: string) => void; onFile: (file: File) => void }) {
  const [url, setUrl] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (url.trim()) onLink(url.trim());
  };
  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-2" onSubmit={submit}>
        <Label htmlFor="lead-import-link">{t("leadImport.link")}</Label>
        <div className="flex gap-2">
          <Input id="lead-import-link" value={url} placeholder="https://docs.google.com/spreadsheets/d/…" onChange={(event) => setUrl(event.target.value)} />
          <Button type="submit" disabled={pending || !url.trim()}>{t("leadImport.load")}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("leadImport.link.hint")}</p>
      </form>
      <Dropzone label={t("leadImport.file")} accept={CSV_TYPES} disabled={pending} onFile={onFile} className="rounded-md border border-dashed border-border p-4 text-center text-sm">
        {t("leadImport.file")}
      </Dropzone>
      {pending ? <Loader label={t("state.loading")} /> : null}
      {problem ? <p role="alert" className="text-sm text-destructive">{problem}</p> : null}
    </div>
  );
}

function ColumnsStep({ boardKey, table, onBack, onImported }: { boardKey: string; table: ImportTable; onBack: () => void; onImported: (outcome: ImportOutcome) => void }) {
  const imports = useLeadImport(boardKey);
  const { mutate: requestPreview } = imports.preview;
  const { data: campaigns } = useCampaignReferences(boardKey);
  const { data: boardColumns } = useLeadColumns(boardKey);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<ColumnRole[]>(() => proposeRoles(table.columns));
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const rows = useMemo(() => rowsOf(table, roles), [table, roles]);
  const preview = imports.preview.data;

  useEffect(() => {
    requestPreview(rows);
  }, [rows, requestPreview]);

  async function run() {
    setProblem(null);
    const chosen = Object.entries(choices).filter(([, campaignId]) => campaignId !== NO_CAMPAIGN);
    try {
      onImported(await imports.run.mutateAsync({
        rows,
        choices: chosen.map(([value, campaignId]) => ({ value: value || null, campaignId })),
        placements: Object.entries(placements).map(([value, columnId]) => ({ value, columnId })),
      }));
    } catch (error) {
      setProblem(failureOf(error));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label={t("leadImport.columns")} className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("leadImport.columns")}</h3>
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {table.columns.map((column, index) => (
            <li key={index} className="flex items-center gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm" title={questionOf(table.columns, index)}>{questionOf(table.columns, index)}</span>
                <span className="block truncate text-xs text-muted-foreground">{sampleOf(table, index) || "—"}</span>
              </span>
              <Select value={roles[index]} onValueChange={(role) => setRoles((current) => assignRole(current, index, role as ColumnRole))}>
                <SelectTrigger aria-label={questionOf(table.columns, index)} className="h-8 w-44 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMN_ROLES.map((role) => <SelectItem key={role} value={role}>{t(`leadImport.role.${role}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </section>

      {preview ? (
        <PreviewSummary
          preview={preview}
          campaigns={campaigns ?? []}
          choices={choices}
          onChoose={(value, campaignId) => setChoices((current) => ({ ...current, [value]: campaignId }))}
          boardColumns={boardColumns ?? []}
          placements={placements}
          onPlace={(value, columnId) => setPlacements((current) => ({ ...current, [value]: columnId }))}
        />
      ) : imports.preview.isError ? (
        <p role="alert" className="text-sm text-destructive">{t("leadImport.error.failed")}</p>
      ) : (
        <Loader label={t("state.loading")} />
      )}

      {problem ? <p role="alert" className="text-sm text-destructive">{problem}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBack}>{t("leadImport.back")}</Button>
        <Button type="button" disabled={!preview || preview.added === 0 || imports.preview.isPending || imports.run.isPending} onClick={() => void run()}>
          {t("leadImport.run").replace("{count}", String(preview?.added ?? 0))}
        </Button>
      </div>
    </div>
  );
}

function PreviewSummary({ preview, campaigns, choices, onChoose, boardColumns, placements, onPlace }: {
  preview: ImportPreview;
  campaigns: ReadonlyArray<{ id: string; name: string }>;
  choices: Readonly<Record<string, string>>;
  onChoose: (value: string, campaignId: string) => void;
  boardColumns: readonly LeadColumn[];
  placements: Readonly<Record<string, string>>;
  onPlace: (value: string, columnId: string) => void;
}) {
  const counts: Array<[MessageKey, number]> = [
    ["leadImport.added", preview.added],
    ["leadImport.skipped.onBoard", preview.skipped.onBoard],
    ["leadImport.skipped.repeated", preview.skipped.repeated],
    ["leadImport.skipped.empty", preview.skipped.empty],
    ["leadImport.undated", preview.undated],
  ];
  const matched = new Map<string, { name: string; leads: number }>();
  for (const group of preview.campaigns) {
    if (!group.campaign) continue;
    const entry = matched.get(group.campaign.id) ?? { name: group.campaign.name, leads: 0 };
    entry.leads += group.leads;
    matched.set(group.campaign.id, entry);
  }
  const unmatched = preview.campaigns.filter((group) => !group.campaign);
  const options = [{ value: NO_CAMPAIGN, label: t("leadImport.campaigns.none") }, ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))];

  return (
    <section aria-label={t("leadImport.preview")} className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {counts.filter(([key, count]) => key === "leadImport.added" || count > 0).map(([key, count]) => (
          <div key={key} className="rounded-md border border-border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{t(key)}</dt>
            <dd className="text-lg font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>

      {preview.added > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("leadImport.campaigns")}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {[...matched].map(([id, entry]) => (
              <li key={id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{entry.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{entry.leads}</span>
              </li>
            ))}
          </ul>
          {unmatched.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">{t("leadImport.campaigns.unmatched")}</p>
              {unmatched.map((group) => {
                const key = group.value ?? "";
                const label = group.value ?? t("leadImport.campaigns.empty");
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate" title={label}>{label}</span>
                      <span className="text-xs text-muted-foreground">{t("leadImport.campaigns.leads").replace("{count}", String(group.leads))}</span>
                    </span>
                    <SearchableSelect
                      className="h-8 w-56 shrink-0"
                      ariaLabel={label}
                      value={choices[key] ?? NO_CAMPAIGN}
                      onValueChange={(campaignId) => onChoose(key, campaignId)}
                      options={options}
                      searchLabel={t("crm.campaign.search")}
                      emptyLabel={t("select.search.empty")}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {preview.added > 0 && preview.statuses.length > 0 ? (
        <StatusPlacement statuses={preview.statuses} boardColumns={boardColumns} placements={placements} onPlace={onPlace} />
      ) : null}
    </section>
  );
}

function StatusPlacement({ statuses, boardColumns, placements, onPlace }: {
  statuses: ImportPreview["statuses"];
  boardColumns: readonly LeadColumn[];
  placements: Readonly<Record<string, string>>;
  onPlace: (value: string, columnId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t("leadImport.stages")}</h3>
      {statuses.map((status) => (
        <div key={status.value} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 text-sm">
            <span className="block truncate" title={status.value}>{status.value}</span>
            <span className="text-xs text-muted-foreground">{t("leadImport.campaigns.leads").replace("{count}", String(status.leads))}</span>
          </span>
          <Select value={placements[status.value] ?? status.column?.id ?? FIRST_COLUMN} onValueChange={(columnId) => onPlace(status.value, columnId)}>
            <SelectTrigger aria-label={status.value} className="h-8 w-56 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {boardColumns.map((column) => <SelectItem key={column.id} value={column.id}>{leadColumnLabel(column)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

function ImportResult({ outcome, onDone }: { outcome: ImportOutcome; onDone: () => void }) {
  const skipped = outcome.skipped.onBoard + outcome.skipped.repeated + outcome.skipped.empty;
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm">
        {t("leadImport.done").replace("{added}", String(outcome.added)).replace("{skipped}", String(skipped))}
      </p>
      <div className="flex justify-end">
        <Button type="button" onClick={onDone}>{t("leadImport.close")}</Button>
      </div>
    </div>
  );
}
