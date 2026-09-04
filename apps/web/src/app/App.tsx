import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { DashboardPage } from "@/pages/dashboard/index.js";
import { ModulePage } from "@/pages/module/index.js";
import { ProjectsPage } from "@/pages/projects/index.js";
import { LoginPage } from "@/pages/login/index.js";
import { RegistrationPage } from "@/pages/registration/index.js";
import { TasksPage } from "@/pages/tasks/index.js";
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
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={`${ROUTES.projects}/*`} element={<ProjectsPage />} />
            <Route path={ROUTES.tasks} element={<TasksPage />} />
            <Route path={ROUTES.reports} element={<ModulePage title={t("nav.reports")} />} />
            <Route path={ROUTES.archive} element={<ModulePage title={t("nav.archive")} />} />
            {/* The client screens moved under Projects; old links still land. */}
            <Route path="/clients/*" element={<Navigate to={ROUTES.projects} replace />} />
            {/* The Team section is gone — members are read in the contact book.
                A bookmark for it lands on the dashboard rather than on the
                shell with an empty pane. */}
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
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Getting in is by invitation link alone. The screen that asked
                for a hand-typed code knew only the employee's shape, so a
                client's code could not be redeemed through it at all. */}
            <Route path="/signup" element={<Navigate to="/login" replace />} />
            {/* Whoever follows an invitation link has no session yet. */}
            <Route path="/regustration/:code" element={<RegistrationPage />} />
            <Route path="/*" element={<Dashboard />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
