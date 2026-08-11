import { DataTable, type DataColumn, type DataRow } from "../../../../components/DataTable/DataTable.js";
import { EmptyState } from "../../../../components/EmptyState/EmptyState.js";
import { Button } from "../../../../components/Button/Button.js";
import { formatDay, formatValue, nextDay, todayIso } from "../../../../lib/format.js";
import { t } from "../../../../i18n/en.js";
import { useCampaignTable, useCreateRecord } from "../../data/queries.js";
import type { CampaignProperty } from "../../data/api.js";
import styles from "./CampaignSheet.module.css";

/** Column id of the leading date column; property ids are uuids, so it cannot collide. */
const DATE_COLUMN = "date";

export interface CampaignSheetProps {
  campaignId: string;
}

function valueCells(
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

  const { properties, records, totals } = table.data;

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
    cells: { [DATE_COLUMN]: formatDay(record.date), ...valueCells(properties, record.values) },
  }));

  const footer: DataRow = {
    id: "totals",
    cells: { [DATE_COLUMN]: t("sheet.total"), ...valueCells(properties, totals) },
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
