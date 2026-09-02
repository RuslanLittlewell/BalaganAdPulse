import { Route, Routes } from "react-router-dom";
import { ProjectList } from "@/widgets/project-list/index.js";
import { ProjectPage } from "@/pages/project/index.js";
import { CampaignPage } from "@/pages/campaign/index.js";
import { EmptyState } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";

/**
 * The Projects module: the project list on the left, the selected project's
 * figures on the right. A project belongs to a client, but the client itself
 * lives in the contact book — this module is about the work.
 */
export function ProjectsPage() {
  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:[&>*:last-child]:border-l lg:[&>*:last-child]:border-border lg:[&>*:last-child]:pl-6">
      <ProjectList />
      <div className="min-w-0">
        <Routes>
          {/* Centred in the pane rather than parked under the top edge: with
              nothing selected the pane is empty, and a prompt hugging the top
              of all that space reads as a page that failed to load. The
              centring lives on this route alone — the screens below fill the
              same pane, and would be squeezed to their content width by it. */}
          <Route
            path="/"
            element={
              <div
                className="flex h-full min-h-0 items-center justify-center"
                data-testid="projects-unselected"
              >
                <EmptyState
                  title={t("projects.unselected.title")}
                  description={t("projects.unselected.description")}
                />
              </div>
            }
          />
          <Route path=":projectId" element={<ProjectPage />} />
          <Route path=":projectId/campaigns/:campaignId" element={<CampaignPage />} />
        </Routes>
      </div>
    </div>
  );
}
