import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { EmptyState, Tabs, useAlerts } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { projectDocumentsPath, projectPath } from "@/shared/lib/index.js";
import { useClients } from "@/entities/client/index.js";
import { ProjectHeader, useActiveProjectId, useProjects, useUpdateProject } from "@/entities/project/index.js";
import { usePreviewMode } from "@/features/preview-mode/index.js";
import { ShareDialog } from "@/features/project-share/index.js";
import { useCan } from "@/features/permissions/index.js";
import { useAuth } from "@/features/auth/index.js";
import { ProjectDocuments } from "@/widgets/project-documents/index.js";
import { ProjectOverview } from "./ProjectOverview.js";

export function ProjectPage() {
  const projectId = useActiveProjectId();
  const navigate = useNavigate();
  const location = useLocation();
  const { previewing, enter: enterPreview } = usePreviewMode();
  const projects = useProjects();
  const { user, role } = useAuth();
  const clients = useClients({ enabled: role !== "PARTNER" });
  const editsProjectKpi = useCan("update", "kpi");
  const editsProject = useCan("update", "project");
  const updateProject = useUpdateProject();
  const { raise } = useAlerts();
  const readsDocuments = useCan("read", "project-document");
  const shares = useCan("update", "share-link");
  const [sharing, setSharing] = useState(false);
  const { documentId } = useParams<{ documentId?: string }>();
  const inDocuments = readsDocuments && /\/documents(\/|$)/.test(location.pathname);

  if (!user || projects.isPending) return null;
  const project = projects.data?.find((candidate) => candidate.id === projectId);
  if (!project) return <EmptyState title={t("project.notFound.title")} />;
  const clientName = clients.data?.find((client) => client.id === project.clientId)?.name ?? "";

  return (
    <div className="flex min-h-full flex-col gap-5">
      {previewing ? null : (
        <ProjectHeader
          project={project}
          showKpi={role !== "PARTNER"}
          clientName={clientName}
          kpiTrackedPending={updateProject.isPending}
          onKpiTrackedChange={editsProject && editsProjectKpi
            ? (kpiTracked) => updateProject.mutate(
                { id: project.id, body: { kpiTracked } },
                { onError: () => raise(t("project.kpiTrackedFailed")) },
              )
            : undefined}
          onPreview={enterPreview}
          onShare={shares ? () => setSharing(true) : undefined}
        />
      )}
      {shares ? <ShareDialog key={project.id} projectId={project.id} open={sharing} onClose={() => setSharing(false)} /> : null}
      {readsDocuments && !previewing ? (
        <div className="border-b border-border pb-3">
          <Tabs
            items={[
              { id: "overview", label: t("project.tab.overview") },
              { id: "documents", label: t("project.tab.documents") },
            ]}
            activeId={inDocuments ? "documents" : "overview"}
            onSelect={(id) => navigate(`${id === "documents" ? projectDocumentsPath(project.id) : projectPath(project.id)}${location.search}`)}
            ariaLabel={t("project.sections")}
          />
        </div>
      ) : null}
      {inDocuments && !previewing ? (
        <ProjectDocuments
          key={project.id}
          projectId={project.id}
          documentId={documentId}
          onOpen={(id) => navigate(`${projectDocumentsPath(project.id, id)}${location.search}`)}
          onClose={() => navigate(`${projectDocumentsPath(project.id)}${location.search}`)}
        />
      ) : <ProjectOverview key={project.id} project={project} previewing={previewing} />}
    </div>
  );
}
