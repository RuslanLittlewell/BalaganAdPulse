import { COLUMN_NAME_LIMIT, type LeadColumn } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";

export function columnNameError(name: string, columns: readonly LeadColumn[], except?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return t("crm.columns.nameRequired");
  if (trimmed.length > COLUMN_NAME_LIMIT) return t("crm.columns.nameTooLong");
  const taken = columns.some(
    (column) => column.id !== except && column.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return taken ? t("crm.columns.nameTaken") : null;
}
