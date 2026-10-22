import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import type { ModuleKey } from "@adpulse/access-policy";
import { DashboardPage } from "@/pages/dashboard/index.js";
import { ArchivePage } from "@/pages/archive/index.js";
import { ProjectsPage } from "@/pages/projects/index.js";
import { ReportsPage } from "@/pages/reports/index.js";
import { LoginPage } from "@/pages/login/index.js";
import { RegistrationPage } from "@/pages/registration/index.js";
import { RequestResetPage, ResetPasswordPage } from "@/pages/password-reset/index.js";
import { TasksPage } from "@/pages/tasks/index.js";
import { CrmPage } from "@/pages/crm/index.js";
import { OrganizationsPage } from "@/pages/organizations/index.js";
import { SuspendedPage } from "@/pages/suspended/index.js";
import { AuthProvider, RequireAuth, SessionHeartbeat, useAuth } from "@/features/auth/index.js";
import { NavCollapseProvider } from "@/features/nav-collapse/index.js";
import { ProjectsSync } from "@/entities/project/index.js";
import { StaffSync } from "@/entities/membership/index.js";
import { AppShell } from "@/widgets/app-shell/index.js";
import { previewedProjectId, usePreviewMode } from "@/features/preview-mode/index.js";
import { AppHeader } from "@/widgets/app-header/index.js";
import { MainNav } from "@/widgets/main-nav/index.js";
import { PlatformHeader } from "@/widgets/platform-header/index.js";
import { PlatformNav } from "@/widgets/platform-nav/index.js";
import { AlertsProvider, Loader } from "@/shared/ui/index.js";
import { createQueryClient, moduleKeyFromPathname, ROUTES } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";

const queryClient = createQueryClient();

function OrganizationArea() {
  const location = useLocation();
  const { modules } = useAuth();
  const { previewing } = usePreviewMode();
  const entitled = (module: ModuleKey, page: ReactNode) =>
    modules.includes(module) ? page : <Navigate to={ROUTES.dashboard} replace />;
  return (
    <NavCollapseProvider>
      <StaffSync />
      <ProjectsSync />
      <SessionHeartbeat />
      <AppShell sidebar={<MainNav />} header={<AppHeader />} moduleKey={moduleKeyFromPathname(location.pathname)} preview={previewing && previewedProjectId(location.pathname) !== null}>
        <Routes location={location}>
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={`${ROUTES.projects}/*`} element={<ProjectsPage />} />
          <Route path={ROUTES.tasks} element={entitled("TASKS", <TasksPage />)} />
          <Route path={ROUTES.crm} element={entitled("CRM", <CrmPage />)} />
          <Route path={`${ROUTES.reports}/*`} element={entitled("REPORTS", <ReportsPage />)} />
          <Route path={ROUTES.archive} element={<ArchivePage />} />
          <Route path="/clients/*" element={<Navigate to={ROUTES.projects} replace />} />
          <Route path="/team" element={<Navigate to={ROUTES.dashboard} replace />} />
        </Routes>
      </AppShell>
    </NavCollapseProvider>
  );
}

function PlatformArea() {
  const location = useLocation();
  return (
    <NavCollapseProvider>
      <SessionHeartbeat />
      <AppShell sidebar={<PlatformNav />} header={<PlatformHeader />} moduleKey={moduleKeyFromPathname(location.pathname)}>
        <Routes location={location}>
          <Route path={ROUTES.organizations} element={<OrganizationsPage />} />
          <Route path="*" element={<Navigate to={ROUTES.organizations} replace />} />
        </Routes>
      </AppShell>
    </NavCollapseProvider>
  );
}

function SignedIn() {
  const { user, platformAdmin, organization } = useAuth();
  if (!user) {
    return (
      <div className="grid h-screen place-items-center bg-background">
        <Loader label={t("state.loading")} />
      </div>
    );
  }
  if (platformAdmin) return <PlatformArea />;
  if (organization?.status === "SUSPENDED") return <SuspendedPage />;
  return <OrganizationArea />;
}

function Dashboard() {
  return (
    <RequireAuth>
      <SignedIn />
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
            <Route path="/password-reset" element={<RequestResetPage />} />
            <Route path="/password-reset/:token" element={<ResetPasswordPage />} />
            <Route path="/*" element={<Dashboard />} />
          </Routes>
        </AuthProvider>
        </AlertsProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
