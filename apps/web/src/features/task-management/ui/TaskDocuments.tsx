import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import {
  MAX_TASK_DOCUMENTS,
  TASKS_KEY,
  documentRefusal,
  documentSize,
  taskDocumentsApi,
  type TaskDocument,
} from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { Button } from "@/shared/ui/index.js";

export interface TaskDocumentsProps {
  documents: readonly TaskDocument[];
  onUploaded?: (document: TaskDocument) => void;
  onRemoved?: (documentId: string) => void;
}

const REVOKE_AFTER_MS = 60_000;

export function TaskDocuments({ documents, onUploaded, onRemoved }: TaskDocumentsProps) {
  const queryClient = useQueryClient();
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const canEdit = onUploaded !== undefined;
  const full = documents.length >= MAX_TASK_DOCUMENTS;

  async function attach(files: readonly File[]) {
    if (!onUploaded) return;
    setFailure(null);
    setUploading(true);
    let held = documents.length;
    for (const file of files) {
      if (held >= MAX_TASK_DOCUMENTS) {
        setFailure(t("tasks.documents.tooMany"));
        break;
      }
      const refusal = documentRefusal(file);
      if (refusal) {
        setFailure(t(`tasks.documents.${refusal}`));
        continue;
      }
      try {
        const { id, name, bytes } = await taskDocumentsApi.upload(file);
        onUploaded({ id, name, bytes });
        held += 1;
      } catch (error) {
        setFailure(error instanceof ApiError && error.status === 400 ? error.message : t("tasks.documents.uploadFailed"));
      }
    }
    setUploading(false);
  }

  async function open(document: TaskDocument) {
    setFailure(null);
    const tab = window.open("", "_blank");
    try {
      const url = await taskDocumentsApi.pdfUrl(document.id);
      if (tab) tab.location.href = url;
      else {
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = document.name;
        anchor.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    } catch {
      tab?.close();
      setFailure(t("tasks.documents.openFailed"));
    }
  }

  async function remove(document: TaskDocument) {
    setFailure(null);
    try {
      await taskDocumentsApi.remove(document.id);
      onRemoved?.(document.id);
      await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    } catch {
      setFailure(t("tasks.documents.removeFailed"));
    }
  }

  return (
    <section aria-label={t("tasks.documents")} className="flex flex-col gap-2" data-testid="task-documents">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          {t("tasks.documents")}
          {documents.length > 0 ? ` (${documents.length})` : ""}
        </h3>
        {canEdit ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              aria-label={t("tasks.documents.attach")}
              disabled={uploading || full}
              onClick={() => picker.current?.click()}
            >
              <Paperclip />
            </Button>
            <input
              ref={picker}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              hidden
              data-testid="task-documents-picker"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                event.target.value = "";
                void attach(files);
              }}
            />
          </>
        ) : null}
      </div>

      {uploading ? <p role="status" className="text-xs text-muted-foreground">{t("tasks.documents.uploading")}</p> : null}

      {documents.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("tasks.documents.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
              <FileText aria-hidden className="size-3 shrink-0 text-muted-foreground" />
              <button
                type="button"
                aria-label={`${t("tasks.documents.open")}: ${document.name}`}
                className="min-w-0 flex-1 truncate text-left text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => void open(document)}
              >
                {document.name}
              </button>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{documentSize(document.bytes)}</span>
              {onRemoved ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  aria-label={`${t("tasks.documents.remove")}: ${document.name}`}
                  onClick={() => void remove(document)}
                >
                  <Trash2 aria-hidden className="size-3" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {failure ? <p role="alert" className="text-xs text-destructive">{failure}</p> : null}
    </section>
  );
}
