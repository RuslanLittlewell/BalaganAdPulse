import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/AppShell/AppShell.js";
import { ClientSidebar } from "./features/clients/components/ClientSidebar/ClientSidebar.js";
import { ClientPage } from "./features/clients/ClientPage/ClientPage.js";
import { EmptyRoute } from "./routes/EmptyRoute.js";
import { AuthProvider } from "./features/auth/AuthProvider.js";
import { RequireAuth } from "./features/auth/RequireAuth.js";
import { LoginPage } from "./features/auth/LoginPage/LoginPage.js";
import { SignupPage } from "./features/auth/SignupPage/SignupPage.js";
import { createQueryClient } from "./lib/queryClient.js";

const queryClient = createQueryClient();

/** The shell and its sidebar belong to the signed-in half of the application;
 * the auth screens stand on their own. */
function Dashboard() {
  return (
    <RequireAuth>
      <AppShell sidebar={<ClientSidebar />}>
        <Routes>
          <Route path="/" element={<EmptyRoute />} />
          <Route path="/clients/:clientId" element={<ClientPage />} />
          <Route path="/clients/:clientId/campaigns/:campaignId" element={<ClientPage />} />
        </Routes>
      </AppShell>
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
