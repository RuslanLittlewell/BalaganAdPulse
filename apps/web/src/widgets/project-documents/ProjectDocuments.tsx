import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { Button, EmptyState, Skeleton } from "@/shared/ui/index.js";
import { useCan } from "@/features/permissions/index.js";
import { useProjectDocument, useProjectDocuments } from "@/entities/project-document/index.js";
import { CreateDocumentDialog } from "./CreateDocumentDialog.js";
import { DocumentSheet } from "./DocumentSheet.js";
import { formatMoment } from "./formatMoment.js";

export interface ProjectDocumentsProps {
  projectId: string;
  documentId?: string;
  onOpen: (documentId: string) => void;
  onClose: () => void;
}

function OpenDocument({
  projectId,
  documentId,
  canWrite,
  onDeleted,
}: {
  projectId: string;
  documentId: string;
  canWrite: boolean;
  onDeleted: () => void;
}) {
  const document = useProjectDocument(projectId, documentId);
  if (document.isError) return <EmptyState title={t("documents.notFound")} />;
  if (!document.data) return <Skeleton className="h-80 w-full" />;
  return (
    <DocumentSheet
      key={document.data.id}
      projectId={projectId}
      document={document.data}
      canWrite={canWrite}
      onDeleted={onDeleted}
    />
  );
}

export function ProjectDocuments({ projectId, documentId, onOpen, onClose }: ProjectDocumentsProps) {
  const canWrite = useCan("create", "project-document");
  const documents = useProjectDocuments(projectId);
  const [creating, setCreating] = useState(false);
  const listed = documents.data ?? [];

  return (
    <div className="grid min-h-[28rem] gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-3 md:border-r md:border-border md:pr-4">
        {canWrite ? (
          <Button type="button" variant="outline" onClick={() => setCreating(true)}>
            <FilePlus2 /> {t("documents.add")}
          </Button>
        ) : null}
        <nav aria-label={t("documents.list")}>
          {documents.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : listed.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t("documents.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {listed.map((entry) => {
                const open = entry.id === documentId;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      aria-current={open ? "page" : undefined}
                      onClick={() => onOpen(entry.id)}
                      className={cn(
                        "flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        open ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                      )}
                    >
                      <span className="w-full truncate text-sm font-medium">{entry.title}</span>
                      <span className="text-xs text-muted-foreground">{formatMoment(entry.updatedAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>

      <section className="min-w-0">
        {documentId ? (
          <OpenDocument
            key={documentId}
            projectId={projectId}
            documentId={documentId}
            canWrite={canWrite}
            onDeleted={onClose}
          />
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {listed.length > 0 ? t("documents.choose") : canWrite ? t("documents.invite") : t("documents.empty")}
          </p>
        )}
      </section>

      {creating ? (
        <CreateDocumentDialog
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            onOpen(created.id);
          }}
        />
      ) : null}
    </div>
  );
}
