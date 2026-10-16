import { http as mock, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aPlatformOrganization, renderWithProviders, server } from "@test/shared/index.js";
import { OrganizationActions } from "@/features/organization-admin/index.js";

function captureUpdate() {
  const bodies: unknown[] = [];
  server.use(mock.patch("/api/platform/organizations/:id", async ({ request }) => {
    bodies.push(await request.json());
    return HttpResponse.json(aPlatformOrganization());
  }));
  return bodies;
}

describe("suspending and reactivating an organization", () => {
  it("asks for confirmation before suspending", async () => {
    const bodies = captureUpdate();
    renderWithProviders(<OrganizationActions organization={aPlatformOrganization()} />);

    await userEvent.click(screen.getByRole("button", { name: "Приостановить: Balagan" }));

    const confirmation = await screen.findByRole("alertdialog", { name: "Приостановить организацию?" });
    expect(confirmation).toHaveTextContent("Balagan");
    expect(bodies).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Приостановить" }));
    await vi.waitFor(() => expect(bodies).toEqual([{ status: "SUSPENDED" }]));
  });

  it("sends nothing when the suspension is cancelled", async () => {
    const bodies = captureUpdate();
    renderWithProviders(<OrganizationActions organization={aPlatformOrganization()} />);

    await userEvent.click(screen.getByRole("button", { name: "Приостановить: Balagan" }));
    await userEvent.click(await screen.findByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it("reactivates a suspended organization at once", async () => {
    const bodies = captureUpdate();
    renderWithProviders(
      <OrganizationActions organization={aPlatformOrganization({ status: "SUSPENDED" })} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Возобновить: Balagan" }));

    await vi.waitFor(() => expect(bodies).toEqual([{ status: "ACTIVE" }]));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("opens the edit dialog", async () => {
    renderWithProviders(<OrganizationActions organization={aPlatformOrganization()} />);

    await userEvent.click(screen.getByRole("button", { name: "Изменить: Balagan" }));

    expect(await screen.findByRole("dialog", { name: "Организация" })).toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toHaveValue("Balagan");
  });
});

describe("the row's icon actions", () => {
  it("offers edit, suspend and delete, each named after the organization", () => {
    renderWithProviders(<OrganizationActions organization={aPlatformOrganization()} />);

    for (const name of ["Изменить: Balagan", "Приостановить: Balagan", "Удалить: Balagan"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("names the action in a tooltip on hover", async () => {
    renderWithProviders(<OrganizationActions organization={aPlatformOrganization()} />);

    await userEvent.hover(screen.getByRole("button", { name: "Удалить: Balagan" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Удалить");
  });
});

describe("deleting an organization", () => {
  function captureDelete() {
    const deleted: string[] = [];
    server.use(mock.delete("/api/platform/organizations/:id", ({ params }) => {
      deleted.push(params.id as string);
      return new HttpResponse(null, { status: 204 });
    }));
    return deleted;
  }

  async function openDelete() {
    renderWithProviders(<OrganizationActions organization={aPlatformOrganization()} />);
    await userEvent.click(screen.getByRole("button", { name: "Удалить: Balagan" }));
    return screen.findByRole("dialog", { name: "Удалить организацию?" });
  }

  it("waits for the organization's exact name before it deletes", async () => {
    const deleted = captureDelete();
    await openDelete();
    const submit = screen.getByRole("button", { name: "Удалить навсегда" });
    const confirmation = screen.getByLabelText("Введите название организации, чтобы подтвердить");

    expect(submit).toBeDisabled();
    await userEvent.type(confirmation, "balagan");
    expect(submit).toBeDisabled();
    await userEvent.clear(confirmation);
    await userEvent.type(confirmation, "Balagan");
    expect(submit).toBeEnabled();

    await userEvent.click(submit);

    await vi.waitFor(() => expect(deleted).toEqual(["org-1"]));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sends nothing when cancelled", async () => {
    const deleted = captureDelete();
    await openDelete();

    await userEvent.type(screen.getByLabelText("Введите название организации, чтобы подтвердить"), "Balagan");
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it("says so when the deletion fails, and keeps the dialog open", async () => {
    server.use(mock.delete("/api/platform/organizations/:id", () =>
      HttpResponse.json({ error: { message: "boom" } }, { status: 500 })));
    await openDelete();

    await userEvent.type(screen.getByLabelText("Введите название организации, чтобы подтвердить"), "Balagan");
    await userEvent.click(screen.getByRole("button", { name: "Удалить навсегда" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось удалить организацию");
    expect(screen.getByRole("dialog", { name: "Удалить организацию?" })).toBeInTheDocument();
  });
});
