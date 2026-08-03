import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/AppShell/AppShell.js";
import { ClientSidebar } from "./features/clients/components/ClientSidebar/ClientSidebar.js";
import { ClientPage } from "./features/clients/ClientPage/ClientPage.js";
import { EmptyRoute } from "./routes/EmptyRoute.js";
import { createQueryClient } from "./lib/queryClient.js";

const queryClient = createQueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell sidebar={<ClientSidebar />}>
          <Routes>
            <Route path="/" element={<EmptyRoute />} />
            <Route path="/clients/:clientId" element={<ClientPage />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
