import { useState, type ReactNode } from "react";
import { HistoryIcon, Trash2Icon } from "lucide-react";
import { DataTable, type DataColumn, type DataRow } from "@/shared/ui/index.js";
import { ConfirmDialog } from "@/shared/ui/index.js";
import { EditableCell } from "@/shared/ui/index.js";
import { EmptyState } from "@/shared/ui/index.js";
import { Button } from "@/shared/ui/index.js";
import { formatDay, formatValue, nextDay, todayIso } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  useCampaignTable,
  useCreateRecord,
  useDeleteRecord,
  useSetValue,
  type CampaignProperty,
  type CampaignRecord,
} from "@/entities/campaign/index.js";
import { normalizeInput, toInputValue } from "./sheetValue.js";
import { SheetDateCell } from "./SheetDateCell.js";
import { useSheetEditing } from "./useSheetEditing.js";
import { Can, useCan } from "@/features/permissions/index.js";

/** Column id of the leading date column; property ids are uuids, so it cannot collide. */
const DATE_COLUMN = "date";

export interface CampaignSheetProps {
  campaignId: string;
  onOpenActivity?: (recordId: string) => void;
}

/** The footer holds aggregates, which are computed and never editable. */
function totalCells(
  properties: CampaignProperty[],
  values: Record<string, string | null>,
): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const property of properties) {
    cells[property.id] = formatValue(values[property.id] ?? null, property.type);
  }
  return cells;
}

export function CampaignSheet({ campaignId, onOpenActivity }: CampaignSheetProps) {
  const table = useCampaignTable(campaignId);
  const addDay = useCreateRecord(campaignId);
  const setValue = useSetValue(campaignId);
  const removeDay = useDeleteRecord(campaignId);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);
  const mayUpdateRecord = useCan("update", "record");
  const mayUpdateValue = useCan("update", "value");
  const mayReadAudit = useCan("read", "audit");

  // Read before the early returns below: hooks may not sit behind a conditional return.
  const properties = table.data?.properties ?? [];
  const records = table.data?.records ?? [];
  const entered = properties.filter((property) => property.formula === null);
  const editing = useSheetEditing(
    records.map((record) => record.id),
    entered.map((property) => property.id),
  );

  function cell(record: CampaignRecord, property: CampaignProperty): ReactNode {
    const stored = record.values[property.id] ?? null;
    const display = formatValue(stored, property.type);
    if (property.formula !== null || !mayUpdateValue) return display;

    return (
      <EditableCell
        display={display}
        value={toInputValue(stored, property.type)}
        label={`${property.name}, ${formatDay(record.date)}`}
        editing={editing.isEditing(record.id, property.id)}
        onOpen={() => editing.open(record.id, property.id)}
        onClose={(direction) =>
          editing.close({ recordId: record.id, propertyId: property.id }, direction)
        }
        onSave={async (raw) => {
          let value: string | null;
          try {
            value = normalizeInput(raw, property.type);
          } catch {
            // The copy belongs to the app, not to the helper that raised the error.
            throw new Error(t("sheet.value.invalid"));
          }
          await setValue.mutateAsync({ recordId: record.id, propertyId: property.id, value });
        }}
      />
    );
  }

  if (table.isPending) return null;

  if (table.isError) {
    return (
      <EmptyState
        title={t("state.error.title")}
        action={
          <Button variant="outline" size="sm" onClick={() => table.refetch()}>
            {t("state.retry")}
          </Button>
        }
      />
    );
  }

  const columns: DataColumn[] = [
    { id: DATE_COLUMN, label: t("sheet.date"), align: "left" },
    ...properties.map((property) => ({
      id: property.id,
      label: property.name,
      align: property.type === "TEXT" ? ("left" as const) : ("right" as const),
    })),
  ];

  const rows: DataRow[] = records.map((record) => ({
    id: record.id,
    cells: {
      [DATE_COLUMN]: (
        mayUpdateRecord
          ? <SheetDateCell campaignId={campaignId} recordId={record.id} date={record.date} />
          : formatDay(record.date)
      ),
      ...Object.fromEntries(properties.map((property) => [property.id, cell(record, property)])),
    },
  }));

  const footer: DataRow = {
    id: "totals",
    cells: { [DATE_COLUMN]: t("sheet.total"), ...totalCells(properties, table.data.totals) },
  };

  const deletingDate = records.find((record) => record.id === deletingId)?.date;

  const lastRecord = records[records.length - 1];
  const nextDate = lastRecord != null ? nextDay(lastRecord.date) : todayIso();

  return (
    <div className={"grid gap-4"}>
      <div className={"flex min-h-16 items-center justify-between gap-4 border-b border-border px-5"}>
        <h2 className={"text-xl font-bold"}>{t("sheet.title")}</h2>
        <Can action="create" resource="record"><Button
          variant="outline"
          size="sm"
          onClick={() => addDay.mutate({ date: nextDate })}
          disabled={addDay.isPending}
        >
          + {t("sheet.addDay")}
        </Button></Can>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        footer={footer}
        rowAction={(mayUpdateRecord || (mayReadAudit && onOpenActivity != null)) ? (row) => (
          <div className="flex justify-end gap-1">
          {mayReadAudit && onOpenActivity != null && <button
            type="button"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`${t("activity.title")}, ${formatDay(records.find((record) => record.id === row.id)!.date)}`}
            onClick={() => onOpenActivity(row.id)}
          >
            <HistoryIcon className="size-3.5" />
          </button>}
          {mayUpdateRecord && <button
            type="button"
            className={"grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"}
            aria-label={`${t("sheet.delete")}, ${formatDay(
              records.find((record) => record.id === row.id)!.date,
            )}`}
            onClick={() => setDeletingId(row.id)}
          >
            <Trash2Icon className="size-3.5" />
          </button>}
          </div>
        ) : undefined}
      />

      <ConfirmDialog
        open={deletingDate != null}
        title={t("sheet.delete.title")}
        description={t("sheet.delete.body")}
        pending={removeDay.isPending}
        onConfirm={() => {
          void (async () => {
            await removeDay.mutateAsync(deletingId!);
            setDeletingId(undefined);
          })();
        }}
        onClose={() => setDeletingId(undefined)}
      />
    </div>
  );
}
