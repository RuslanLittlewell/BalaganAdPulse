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

});


describe("an administrator cannot remove themselves", () => {
  const self = {
    id: "membership-1",
    userId: "user-1",
    name: "Alexey",
    email: "alexey@example.com",
    image: null,
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: "2026-08-31T09:00:00.000Z",
  } as const;

  /**
   * The API refuses this with a conflict; hiding the control keeps an admin
   * from discovering the rule by pressing a button that looks available. The
   * acting row is identified by the account behind it, which the session and
   * the member list both name.
   */
  it("offers no removal control on the acting member's own row", async () => {
    session("ADMIN");
    server.use(http.get("/api/members", () => HttpResponse.json([self, manager])));

    renderWithProviders(<TeamPage />);
    await screen.findByText("Maria Manager");

    expect(screen.queryByRole("button", { name: "Удалить Alexey" })).not.toBeInTheDocument();
    // Everybody else stays removable.
    expect(screen.getByRole("button", { name: "Удалить Maria Manager" })).toBeInTheDocument();
  });

  it("still offers the other controls on that row", async () => {
    session("ADMIN");
    server.use(http.get("/api/members", () => HttpResponse.json([self, manager])));

    renderWithProviders(<TeamPage />);
    await screen.findByText("Maria Manager");

    // Only removal is withheld: an admin may still change their own role, which
    // the last-admin rule protects separately.
    expect(screen.getByLabelText("Роль Alexey")).toBeInTheDocument();
  });
});


describe("invitations have left the Team page", () => {
  /**
   * Onboarding now lives in the contact book, beside the people it creates.
   * The Team page must not merely hide the controls: it must stop asking for
   * invitations at all, or every visit costs a request nothing renders.
   */
  it("makes no invitation request", async () => {
    session("ADMIN");
    let asked = false;
    server.use(
      http.get("/api/members", () => HttpResponse.json([manager])),
      http.get("/api/invites", () => { asked = true; return HttpResponse.json([]); }),
    );

    renderWithProviders(<TeamPage />);
    await screen.findByText("Maria Manager");
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(asked).toBe(false);
  });

  it("offers no invitation controls", async () => {
    session("ADMIN");
    server.use(http.get("/api/members", () => HttpResponse.json([manager])));

    renderWithProviders(<TeamPage />);
    await screen.findByText("Maria Manager");

    expect(screen.queryByText("Приглашения")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Создать приглашение" })).not.toBeInTheDocument();
  });
});
