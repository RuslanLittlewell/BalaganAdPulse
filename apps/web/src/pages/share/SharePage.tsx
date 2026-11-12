import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import { useSharedProject } from "@/entities/project/index.js";
import { SharedAuthProvider } from "@/features/auth/index.js";
import { NavCollapseProvider } from "@/features/nav-collapse/index.js";
import { AppShell } from "@/widgets/app-shell/index.js";
import { ProjectOverview } from "@/pages/project/index.js";
import { CampaignPage } from "@/pages/campaign/index.js";
import { EmptyState, Loader } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import {
  ApiError, createQueryClient, enterShareScope, leaveShareScope, ShareScopeContext,
} from "@/shared/lib/index.js";

function useKeptOutOfSearch() {
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.append(robots);
    return () => robots.remove();
  }, []);
}

function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title === undefined) return;
    const before = document.title;
    document.title = title;
    return () => { document.title = before; };
  }, [title]);
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="grid h-dvh place-items-center bg-background p-4 text-foreground">{children}</div>;
}

function SharedProject({ token }: { token: string }) {
  const shared = useSharedProject();
  useDocumentTitle(shared.data?.project.name);

  if (shared.isError) {
    const dead = shared.error instanceof ApiError && shared.error.status === 404;
    return (
      <Centered>
        {dead ? (
          <EmptyState title={t("share.unavailable.title")} description={t("share.unavailable.description")} />
        ) : (
          <EmptyState title={t("state.error.title")} actionLabel={t("state.retry")} onAction={() => void shared.refetch()} />
        )}
      </Centered>
    );
  }
  if (shared.isPending) {
    return <Centered><Loader label={t("state.loading")} /></Centered>;
  }

  const { project, modules } = shared.data;
  return (
    <ShareScopeContext.Provider value={{ token, projectId: project.id }}>
      <SharedAuthProvider modules={modules}>
        <NavCollapseProvider>
          <AppShell sidebar={null} header={null} moduleKey="share" preview>
            <div className="flex min-h-full flex-col gap-5">
              <h1 className="truncate text-lg font-semibold text-foreground">{project.name}</h1>
              <Routes>
                <Route index element={<ProjectOverview project={project} previewing />} />
                <Route path="campaigns/:campaignId" element={<CampaignPage project={project} />} />
              </Routes>
            </div>
          </AppShell>
        </NavCollapseProvider>
      </SharedAuthProvider>
    </ShareScopeContext.Provider>
  );
}

export function SharePage({ token }: { token: string }) {
  const [client] = useState(createQueryClient);
  const [scoped, setScoped] = useState(false);
  useKeptOutOfSearch();

  useLayoutEffect(() => {
    enterShareScope(token);
    setScoped(true);
    return () => {
      leaveShareScope();
      setScoped(false);
    };
  }, [token]);

  if (!scoped) return null;
  return (
    <QueryClientProvider client={client}>
      <SharedProject token={token} />
    </QueryClientProvider>
  );
}
