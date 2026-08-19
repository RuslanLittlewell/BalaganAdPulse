import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "../lib/queryClient.js";
import { AuthProvider } from "../features/auth/AuthProvider.js";
import { writeTokens, clearTokens } from "../lib/auth/tokenStore.js";
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

  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options?.route ?? "/"]}>
        <AuthProvider>{ui}</AuthProvider>
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
