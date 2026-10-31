import { useState } from "react";
import { ArrowLeftIcon, Trash2 } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { Button, ConfirmDialog } from "@/shared/ui/index.js";
import {
  useDeleteProjectDocument,
  useSaveProjectDocument,
  type ProjectDocument,
} from "@/entities/project-document/index.js";
import { DocumentEditor } from "./DocumentEditor.js";
import { formatMoment } from "./formatMoment.js";
import { useAutosave, type SaveStatus } from "./useAutosave.js";

export interface DocumentSheetProps {
  projectId: string;
  document: ProjectDocument;
  canWrite: boolean;
  onBack: () => void;
  onDeleted: () => void;
}

const STATUS_KEY: Record<Exclude<SaveStatus, "idle">, "documents.saving" | "documents.saved" | "documents.failed"> = {
  saving: "documents.saving",
  saved: "documents.saved",
  failed: "documents.failed",
};

export function DocumentSheet({ projectId, document, canWrite, onBack, onDeleted }: DocumentSheetProps) {
  const [title, setTitle] = useState(document.title);
  const [confirming, setConfirming] = useState(false);
  const save = useSaveProjectDocument(projectId, document.id);
  const remove = useDeleteProjectDocument(projectId);
  const autosave = useAutosave((change) => save.mutateAsync(change));

  const changed = [
    `${t("documents.changed")} ${formatMoment(document.updatedAt)}`,
    document.updatedBy?.name,
  ].filter(Boolean).join(" · ");

  return (
    <article className="flex min-w-0 flex-col gap-3" aria-label={title || document.title}>
      <div className="flex items-start justify-between gap-3">
        <Button type="button" variant="ghost" size="icon" aria-label={t("documents.back")} onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        {canWrite ? (
          <input
            aria-label={t("documents.name")}
            className="min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            value={title}
            maxLength={120}
            onChange={(event) => {
              setTitle(event.target.value);
              autosave.schedule({ title: event.target.value });
            }}
          />
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-2xl font-semibold">{document.title}</h2>
        )}
        {canWrite ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("documents.delete")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>

      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span>{changed}</span>
        {autosave.status !== "idle" ? (
          <span role="status" data-status={autosave.status} className={autosave.status === "failed" ? "text-destructive" : undefined}>
            {t(STATUS_KEY[autosave.status])}
          </span>
        ) : null}
      </p>

      <DocumentEditor
        value={document.content}
        editable={canWrite}
        onChange={(content) => autosave.schedule({ content })}
      />

      <ConfirmDialog
        open={confirming}
        title={t("documents.delete.title")}
        description={`«${document.title}» ${t("documents.delete.body")}`}
        pending={remove.isPending}
        onConfirm={() => {
          autosave.discard();
          remove.mutate(document.id, {
            onSuccess: () => {
              setConfirming(false);
              onDeleted();
            },
          });
        }}
        onClose={() => setConfirming(false)}
      />
    </article>
  );
}
