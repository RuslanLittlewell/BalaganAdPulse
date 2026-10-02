import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server } from "@test/shared/index.js";
import { InvitationDialog } from "@/features/invitations/index.js";

const created = {
  id: "invite-1", code: "ABCDEFGH", registrationType: "EMPLOYEE", role: "MANAGER",
  projectIds: [], clientId: null, email: null, expiresAt: null, revokedAt: null, usedAt: null,
  usedById: null, createdById: null, createdAt: "2026-10-01T00:00:00.000Z",
  status: "PENDING", registrationUrl: "/regustration/ABCDEFGH",
};

function capturing() {
  const bodies: unknown[] = [];
  server.use(
    http.get("/api/projects", () => HttpResponse.json([])),
    http.post("/api/invites", async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(created, { status: 201 });
    }),
  );
  return bodies;
}

async function chooseRole(name: string) {
  const user = userEvent.setup();
  renderWithProviders(<InvitationDialog registrationType="EMPLOYEE" open onClose={() => {}} />);
  await user.click(await screen.findByRole("combobox", { name: "Роль приглашения" }));
  await user.click(await screen.findByRole("option", { name }));
  return user;
}

describe("inviting an employee", () => {
  it("sends a manager invitation that names no projects", async () => {
    const bodies = capturing();
    const user = await chooseRole("Менеджер");

    await user.click(screen.getByRole("button", { name: "Создать приглашение" }));

    expect(await screen.findByText(/regustration\/ABCDEFGH/)).toBeInTheDocument();
    expect(bodies).toEqual([{ registrationType: "EMPLOYEE", role: "MANAGER", projectIds: [] }]);
  });

  it("refuses a guest invitation that names no projects", async () => {
    const bodies = capturing();
    const user = await chooseRole("Гость");

    await user.click(screen.getByRole("button", { name: "Создать приглашение" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Выберите хотя бы один проект");
    expect(bodies).toEqual([]);
  });
});
