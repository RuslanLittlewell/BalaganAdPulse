import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "@/shared/lib/index.js";
import { AuthProvider } from "@/features/auth/index.js";
import { SelectionSync, useSelectionStore } from "@/entities/project/index.js";
import { NavCollapseProvider } from "@/features/nav-collapse/index.js";
import { writeTokens, clearTokens } from "@/shared/lib/index.js";
import { makeAccessToken } from "./token.js";

export interface RenderOptions {
  route?: string;
  /** Page tests are about the page, not about getting past the guard, so a
   * live session is the default. A fresh, unexpired token also keeps
   * lib/http.ts from renewing, which MSW would reject as unhandled. */
  signedIn?: boolean;
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  if (options?.signedIn === false) {
    clearTokens();
  } else {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "test-refresh" });
  }

  // The selection store is a module singleton, so one test's route must not
  // leak into the next one's.
  useSelectionStore.setState({ projectId: undefined, campaignId: undefined });

  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options?.route ?? "/"]}>
        <AuthProvider>
          <NavCollapseProvider>
            <SelectionSync />
            {ui}
          </NavCollapseProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function hookWrapper() {
  const client = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
