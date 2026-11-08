import { t } from "@/shared/config/index.js";

export const MAX_TASK_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_TASK_DOCUMENTS = 10;

export type DocumentRefusal = "wrongType" | "tooLarge";

export function documentRefusal(file: Pick<File, "type" | "size" | "name">): DocumentRefusal | null {
  const pdf = file.type === "application/pdf" || (file.type === "" && /\.pdf$/i.test(file.name));
  if (!pdf) return "wrongType";
  if (file.size > MAX_TASK_DOCUMENT_BYTES) return "tooLarge";
  return null;
}

export function documentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${t("crm.files.bytes")}`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ${t("crm.files.kb")}`;
  return `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ${t("crm.files.mb")}`;
}
