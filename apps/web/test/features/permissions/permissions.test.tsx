import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@test/shared/index.js";
import { makeAccessToken } from "@test/shared/index.js";
import { AuthProvider } from "@/features/auth/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { createQueryClient, writeTokens } from "@/shared/lib/index.js";
import type { Role } from "@adpulse/access-policy";

function PermissionProbe() {
  const mayEditClient = useCan("update", "client");
  return (
    <div>
      <span>{mayEditClient ? "may edit" : "read only"}</span>
      <Can action="delete" resource="client" fallback={<span>cannot delete</span>}>
        <button>Delete client</button>
      </Can>
    </div>
  );
}

function renderPermissions(role?: Role) {
  if (role) {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "refresh" });
    server.use(http.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Alexey", email: "alexey@example.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role,
      clientIds: [],
    })));
  }

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <AuthProvider>
          <PermissionProbe />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe("permissions", () => {
  it("uses the shared matrix with the current session role", async () => {
    renderPermissions("MANAGER");

    expect(await screen.findByText("may edit")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete client" })).not.toBeInTheDocument();
    expect(screen.getByText("cannot delete")).toBeInTheDocument();
  });

  it("renders guarded content when the role permits the action", async () => {
    renderPermissions("ADMIN");

    expect(await screen.findByRole("button", { name: "Delete client" })).toBeInTheDocument();
    expect(screen.queryByText("cannot delete")).not.toBeInTheDocument();
  });

  it("fails closed while there is no authenticated role", () => {
    renderPermissions();

    expect(screen.getByText("read only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete client" })).not.toBeInTheDocument();
  });
});
