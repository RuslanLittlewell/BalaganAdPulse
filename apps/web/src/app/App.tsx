import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { DashboardPage } from "@/pages/dashboard/index.js";
import { ModulePage } from "@/pages/module/index.js";
import { ProjectsPage } from "@/pages/projects/index.js";
import { LoginPage } from "@/pages/login/index.js";
import { RegistrationPage } from "@/pages/registration/index.js";
import { TasksPage } from "@/pages/tasks/index.js";
import { CrmPage } from "@/pages/crm/index.js";
import { AuthProvider, RequireAuth, SessionHeartbeat } from "@/features/auth/index.js";
import { NavCollapseProvider } from "@/features/nav-collapse/index.js";
import { SelectionSync } from "@/entities/project/index.js";
import { StaffSync } from "@/entities/membership/index.js";
import { AppShell } from "@/widgets/app-shell/index.js";
import { AppHeader } from "@/widgets/app-header/index.js";
import { MainNav } from "@/widgets/main-nav/index.js";
import { AlertsProvider } from "@/shared/ui/index.js";
import { createQueryClient, ROUTES } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";

const queryClient = createQueryClient();

function Dashboard() {
  return (
    <RequireAuth>
      <NavCollapseProvider>
        <SelectionSync />
        <StaffSync />
        <SessionHeartbeat />
        <AppShell sidebar={<MainNav />} header={<AppHeader />}>
          <Routes>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={`${ROUTES.projects}/*`} element={<ProjectsPage />} />
            <Route path={ROUTES.tasks} element={<TasksPage />} />
            <Route path={ROUTES.crm} element={<CrmPage />} />
            <Route path={ROUTES.reports} element={<ModulePage title={t("nav.reports")} />} />
            <Route path={ROUTES.archive} element={<ModulePage title={t("nav.archive")} />} />
            <Route path="/clients/*" element={<Navigate to={ROUTES.projects} replace />} />
            <Route path="/team" element={<Navigate to={ROUTES.dashboard} replace />} />
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
        <AlertsProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<Navigate to="/login" replace />} />
            <Route path="/regustration/:code" element={<RegistrationPage />} />
            <Route path="/*" element={<Dashboard />} />
          </Routes>
        </AuthProvider>
        </AlertsProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
