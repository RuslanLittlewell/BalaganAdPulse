import { useRef, useState } from "react";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { leadsApi, useAttachLeadFile, useLeadFiles, useRemoveLeadFile, type LeadFile } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { Button, ConfirmDialog, Loader, useAlerts } from "@/shared/ui/index.js";

export interface LeadFilesTabProps {
  boardKey: string;
  leadId: string;
  editable: boolean;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${t("crm.files.bytes")}`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ${t("crm.files.kb")}`;
  return `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ${t("crm.files.mb")}`;
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.status < 500 ? error.message : fallback;

export function LeadFilesTab({ boardKey, leadId, editable }: LeadFilesTabProps) {
  const { data: files, isPending } = useLeadFiles(boardKey, leadId);
  const attach = useAttachLeadFile(boardKey, leadId);
  const remove = useRemoveLeadFile(boardKey, leadId);
  const { raise } = useAlerts();
  const picker = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<LeadFile | null>(null);

  async function download(file: LeadFile) {
    try {
      const blob = await leadsApi.downloadFile(boardKey, leadId, file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      raise(messageOf(error, t("crm.files.downloadFailed")));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {editable ? (
        <div>
          <input
            ref={picker}
            type="file"
            aria-label={t("crm.files.attach")}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              attach.mutate(file, { onError: (error) => raise(messageOf(error, t("crm.files.failed"))) });
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={attach.isPending} onClick={() => picker.current?.click()}>
            <Paperclip aria-hidden className="size-4" />
            {t("crm.files.attach")}
          </Button>
        </div>
      ) : null}

      {isPending ? <Loader label={t("state.loading")} /> : !files?.length ? (
        <p className="text-sm text-muted-foreground">{t("crm.files.empty")}</p>
      ) : (
        <ul aria-label={t("crm.card.files")} className="flex flex-col gap-2">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatBytes(file.bytes)} · {file.uploader?.name ?? ""} · {new Date(file.createdAt).toLocaleString("ru-RU")}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`${t("crm.files.download")} ${file.name}`} onClick={() => void download(file)}>
                <Download aria-hidden className="size-4" />
              </Button>
              {editable ? (
                <Button type="button" variant="ghost" size="icon" aria-label={`${t("crm.files.remove")} ${file.name}`} onClick={() => setRemoving(file)}>
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={t("crm.files.removeTitle")}
        description={removing ? `${t("crm.files.removeBody")}: ${removing.name}` : ""}
        confirmLabel={t("crm.files.removeTitle")}
        pending={remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.id, {
            onSuccess: () => setRemoving(null),
            onError: (error) => { setRemoving(null); raise(messageOf(error, t("crm.files.failed"))); },
          });
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
