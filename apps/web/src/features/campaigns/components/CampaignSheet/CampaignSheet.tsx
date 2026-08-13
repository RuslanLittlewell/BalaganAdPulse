import type { ReactNode } from "react";
import { DataTable, type DataColumn, type DataRow } from "../../../../components/DataTable/DataTable.js";
import { EditableCell } from "../../../../components/EditableCell/EditableCell.js";
import { EmptyState } from "../../../../components/EmptyState/EmptyState.js";
import { Button } from "../../../../components/Button/Button.js";
import { formatDay, formatValue, nextDay, todayIso } from "../../../../lib/format.js";
import { t } from "../../../../i18n/en.js";
import { useCampaignTable, useCreateRecord, useSetValue } from "../../data/queries.js";
import type { CampaignProperty, CampaignRecord } from "../../data/api.js";
import { normalizeInput, toInputValue } from "./sheetValue.js";
import { useSheetEditing } from "./useSheetEditing.js";
import styles from "./CampaignSheet.module.css";

/** Column id of the leading date column; property ids are uuids, so it cannot collide. */
const DATE_COLUMN = "date";

export interface CampaignSheetProps {
  campaignId: string;
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

export function CampaignSheet({ campaignId }: CampaignSheetProps) {
  const table = useCampaignTable(campaignId);
  const addDay = useCreateRecord(campaignId);
  const setValue = useSetValue(campaignId);

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
    if (property.formula !== null) return display;

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
          <Button variant="ghost" size="sm" onClick={() => table.refetch()}>
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
      [DATE_COLUMN]: formatDay(record.date),
      ...Object.fromEntries(properties.map((property) => [property.id, cell(record, property)])),
    },
  }));

  const footer: DataRow = {
    id: "totals",
    cells: { [DATE_COLUMN]: t("sheet.total"), ...totalCells(properties, table.data.totals) },
  };

  const lastRecord = records[records.length - 1];
  const nextDate = lastRecord != null ? nextDay(lastRecord.date) : todayIso();

  return (
    <div className={styles.sheet}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t("sheet.title")}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addDay.mutate({ date: nextDate })}
          disabled={addDay.isPending}
        >
          + {t("sheet.addDay")}
        </Button>
      </div>
      <DataTable columns={columns} rows={rows} footer={footer} />
    </div>
  );
}
