import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "@/shared/lib/index.js";
import { AuthProvider } from "@/features/auth/index.js";
import { AlertsProvider } from "@/shared/ui/index.js";
import { SelectionSync, useSelectionStore } from "@/entities/project/index.js";
import { NavCollapseProvider } from "@/features/nav-collapse/index.js";
import { writeTokens, clearTokens } from "@/shared/lib/index.js";
import { makeAccessToken } from "./token.js";

export interface RenderOptions {
  route?: string;
  signedIn?: boolean;
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  if (options?.signedIn === false) {
    clearTokens();
  } else {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "test-refresh" });
  }

  useSelectionStore.setState({ projectId: undefined, campaignId: undefined });

  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options?.route ?? "/"]}>
        <AlertsProvider>
        <AuthProvider>
          <NavCollapseProvider>
            <SelectionSync />
            {ui}
          </NavCollapseProvider>
        </AuthProvider>
        </AlertsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function hookWrapper() {
  const client = createQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.client = client;
  return Wrapper;
}
