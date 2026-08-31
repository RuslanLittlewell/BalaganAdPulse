import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { ModulePage } from "@/pages/module/index.js";
import { ProjectsPage } from "@/pages/projects/index.js";
import { LoginPage } from "@/pages/login/index.js";
import { SignupPage } from "@/pages/signup/index.js";
import { AuthProvider, RequireAuth } from "@/features/auth/index.js";
import { NavCollapseProvider } from "@/features/nav-collapse/index.js";
import { SelectionSync } from "@/entities/project/index.js";
import { AppShell } from "@/widgets/app-shell/index.js";
import { AppHeader } from "@/widgets/app-header/index.js";
import { MainNav } from "@/widgets/main-nav/index.js";
import { createQueryClient, ROUTES } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";

const queryClient = createQueryClient();

/** The shell and its navigation belong to the signed-in half of the
 * application; the auth screens stand on their own. */
function Dashboard() {
  return (
    <RequireAuth>
      <NavCollapseProvider>
        <SelectionSync />
        <AppShell sidebar={<MainNav />} header={<AppHeader />}>
          <Routes>
            <Route path={ROUTES.dashboard} element={<ModulePage title={t("nav.dashboard")} />} />
            <Route path={`${ROUTES.projects}/*`} element={<ProjectsPage />} />
            <Route path={ROUTES.tasks} element={<ModulePage title={t("nav.tasks")} />} />
            <Route path={ROUTES.reports} element={<ModulePage title={t("nav.reports")} />} />
            <Route path={ROUTES.archive} element={<ModulePage title={t("nav.archive")} />} />
            {/* The client screens moved under Projects; old links still land. */}
            <Route path="/clients/*" element={<Navigate to={ROUTES.projects} replace />} />
          </Routes>
        </AppShell>
      </NavCollapseProvider>
    </RequireAuth>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/*" element={<Dashboard />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
