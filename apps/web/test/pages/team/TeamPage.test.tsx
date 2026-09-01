import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server, renderWithProviders } from "@test/shared/index.js";
import { TeamPage } from "@/pages/team/index.js";

const manager = {
  id: "membership-2",
  userId: "user-2",
  name: "Maria Manager",
  email: "maria@example.com",
  image: null,
  role: "MANAGER",
  status: "ACTIVE",
  createdAt: "2026-08-31T10:00:00.000Z",
} as const;

function session(role: "ADMIN" | "MANAGER") {
  server.use(http.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Alexey", email: "alexey@example.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role,
    clientIds: [],
  })));
}

describe("TeamPage", () => {
  it("opens organization-wide activity from the admin area", async () => {
    session("ADMIN");
    let auditUrl: URL | undefined;
    server.use(
      http.get("/api/members", () => HttpResponse.json([])),
      http.get("/api/invites", () => HttpResponse.json([])),
      http.get("/api/audit", ({ request }) => {
        auditUrl = new URL(request.url);
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );
    renderWithProviders(<TeamPage />);

    await userEvent.click(await screen.findByRole("button", { name: "История действий" }));
    expect(await screen.findByRole("dialog", { name: "История действий" })).toBeInTheDocument();
    await waitFor(() => expect(auditUrl?.search).toBe(""));
  });

  it("lets an admin change role, suspend and remove a member", async () => {
    session("ADMIN");
    let patchBody: unknown;
    let removed = false;
    server.use(
      http.get("/api/members", () => HttpResponse.json([manager])),
      http.patch("/api/members/:id", async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json({ ...manager, ...(patchBody as object) });
      }),
      http.delete("/api/members/:id", () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<TeamPage />);
    expect(await screen.findByText("Maria Manager")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Роль Maria Manager" }), "GUEST");
    await waitFor(() => expect(patchBody).toEqual({ role: "GUEST" }));

    await userEvent.click(screen.getByRole("button", { name: "Приостановить Maria Manager" }));
    await waitFor(() => expect(patchBody).toEqual({ status: "SUSPENDED" }));

    await userEvent.click(screen.getByRole("button", { name: "Удалить Maria Manager" }));
    await userEvent.click(screen.getByRole("button", { name: "Удалить участника" }));
    await waitFor(() => expect(removed).toBe(true));
  });

  it("does not expose the member list or its controls to a manager", async () => {
    session("MANAGER");
    let requested = false;
    server.use(http.get("/api/members", () => {
      requested = true;
      return HttpResponse.json([manager]);
    }));

    renderWithProviders(<TeamPage />);

    expect(await screen.findByText("Недостаточно прав")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Maria Manager/ })).not.toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("creates, shows and revokes pending invitations", async () => {
    session("ADMIN");
    let createBody: unknown;
    let revoked = false;
    server.use(
      http.get("/api/members", () => HttpResponse.json([])),
      http.get("/api/invites", () => HttpResponse.json([
        {
          id: "invite-pending", code: "pending-code", role: "GUEST", email: null,
          expiresAt: null, revokedAt: null, usedAt: null, status: "PENDING", createdAt: "",
        },
        {
          id: "invite-used", code: "used-code", role: "MANAGER", email: null,
          expiresAt: null, revokedAt: null, usedAt: "2026-08-31T12:00:00Z", status: "USED", createdAt: "",
        },
      ])),
      http.post("/api/invites", async ({ request }) => {
        createBody = await request.json();
        return HttpResponse.json({
          id: "invite-new", code: "brand-new-code", role: "CLIENT", email: null,
          expiresAt: null, revokedAt: null, usedAt: null, status: "PENDING", createdAt: "",
        }, { status: 201 });
      }),
      http.delete("/api/invites/invite-pending", () => {
        revoked = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<TeamPage />);

    expect(await screen.findByText("pending-code")).toBeInTheDocument();
    expect(screen.queryByText("used-code")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Роль приглашения" }), "CLIENT");
    await userEvent.click(screen.getByRole("button", { name: "Создать приглашение" }));
    expect(await screen.findByText("brand-new-code")).toBeInTheDocument();
    expect(createBody).toEqual({ role: "CLIENT" });

    await userEvent.click(screen.getByRole("button", { name: "Отозвать pending-code" }));
    await waitFor(() => expect(revoked).toBe(true));
  });
});
