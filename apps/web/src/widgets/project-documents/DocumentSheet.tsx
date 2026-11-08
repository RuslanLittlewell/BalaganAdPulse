import { useRef, useState } from "react";
import { ArrowLeftIcon, Trash2 } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { Button, ConfirmDialog, useAlerts } from "@/shared/ui/index.js";
import {
  projectDocumentsApi,
  useDeleteProjectDocument,
  useSaveProjectDocument,
  type ProjectDocument,
} from "@/entities/project-document/index.js";
import { useAuth } from "@/features/auth/index.js";
import { DocumentEditor } from "./DocumentEditor.js";
import { formatMoment } from "./formatMoment.js";
import { useAutosave, type SaveStatus } from "./useAutosave.js";

export interface DocumentSheetProps {
  projectId: string;
  document: ProjectDocument;
  canWrite: boolean;
  onBack: () => void;
  onDeleted: () => void;
  onReload: (document: ProjectDocument) => void;
}

const STATUS_KEY: Record<Exclude<SaveStatus, "idle">, "documents.saving" | "documents.saved" | "documents.failed" | "documents.conflict"> = {
  saving: "documents.saving",
  saved: "documents.saved",
  conflict: "documents.conflict",
  failed: "documents.failed",
};

export function DocumentSheet({ projectId, document, canWrite, onBack, onDeleted, onReload }: DocumentSheetProps) {
  const [confirming, setConfirming] = useState(false);
  const save = useSaveProjectDocument(projectId, document.id);
  const remove = useDeleteProjectDocument(projectId);
  const { user, membershipId } = useAuth();
  const { raise } = useAlerts();
  const [resolving, setResolving] = useState(false);
  const autosave = useAutosave((change, expectedRevision) => save.mutateAsync({ ...change, expectedRevision }), {
    revision: document.revision,
    storageKey: canWrite && user ? `adpulse.document-draft:${user.id}:${membershipId}:${projectId}:${document.id}` : undefined,
  });
  const [title, setTitle] = useState(autosave.initialChange?.title ?? document.title);
  const currentTitle = useRef(title);
  currentTitle.current = title;
  const [initialContent] = useState(autosave.initialChange?.content === undefined ? document.content : autosave.initialChange.content);
  const content = useRef(initialContent);
  const resolve = async (keepLocal: boolean) => {
    setResolving(true);
    try {
      const latest = await projectDocumentsApi.read(projectId, document.id);
      if (keepLocal) {
        autosave.schedule({ title: currentTitle.current, content: content.current });
        await autosave.retry(latest.revision);
      }
      else { autosave.discard(); onReload(latest); }
    } catch { raise(t("state.error.title")); }
    finally { setResolving(false); }
  };

  const changed = [
    `${t("documents.changed")} ${formatMoment(document.updatedAt)}`,
    document.updatedBy?.name,
  ].filter(Boolean).join(" · ");

  return (
    <article className="flex min-w-0 flex-col gap-2" aria-label={title || document.title}>
      <div className="flex items-start justify-between gap-2">
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

      <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        <span>{changed}</span>
        {autosave.status !== "idle" ? (
          <span role="status" data-status={autosave.status} className={autosave.status === "failed" ? "text-destructive" : undefined}>
            {t(STATUS_KEY[autosave.status])}
          </span>
        ) : null}
      </p>

      {autosave.storageFailed ? <p role="alert">{t("documents.draftFailed")}</p> : null}
      {autosave.status === "failed" ? (
        <Button type="button" variant="outline" size="sm" onClick={() => void autosave.retry()}>{t("state.retry")}</Button>
      ) : null}
      {autosave.status === "conflict" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={resolving} onClick={() => void resolve(true)}>{t("documents.keepMine")}</Button>
          <Button type="button" variant="outline" size="sm" disabled={resolving} onClick={() => void resolve(false)}>{t("documents.loadServer")}</Button>
        </div>
      ) : null}
      <DocumentEditor
        value={initialContent}
        editable={canWrite}
        onChange={(next) => { content.current = next; autosave.schedule({ content: next }); }}
      />

      <ConfirmDialog
        open={confirming}
        title={t("documents.delete.title")}
        description={`«${document.title}» ${t("documents.delete.body")}`}
        pending={remove.isPending}
        onConfirm={() => {
          remove.mutate(document.id, {
            onSuccess: () => {
              autosave.discard();
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
