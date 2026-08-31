import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "@test/shared/index.js";
import { renderWithProviders } from "@test/shared/index.js";
import { CampaignFormDialog } from "@/features/campaign-management/ui/campaign-form-dialog/CampaignFormDialog.js";

const campaign = {
  id: "c1", projectId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "",
};

describe("CampaignFormDialog", () => {
  it("creates a sheet and reports the created campaign", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/projects/1/campaigns", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ ...campaign, id: "c9", name: "Display" }, { status: 201 });
      }),
    );
    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderWithProviders(
      <CampaignFormDialog projectId="1" onClose={onClose} onCreated={onCreated} />,
    );

    await userEvent.type(screen.getByLabelText("Имя"), "  Display  ");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(received).toEqual({ name: "Display" });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "c9" }));
  });

  it("disables Создать until a name is entered", async () => {
    renderWithProviders(<CampaignFormDialog projectId="1" onClose={() => {}} />);

    expect(screen.getByRole("button", { name: "Создать" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Имя"), "Display");
    expect(screen.getByRole("button", { name: "Создать" })).toBeEnabled();
  });

  it("prefills the name in rename mode and saves with PATCH", async () => {
    let method = "";
    server.use(
      mock.patch("/api/campaigns/c1", async ({ request }) => {
        method = request.method;
        return HttpResponse.json({ ...campaign, name: "Renamed" });
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(
      <CampaignFormDialog projectId="1" campaign={campaign} onClose={onClose} />,
    );

    expect(screen.getByLabelText("Имя")).toHaveValue("Search ads");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(method).toBe("PATCH");
  });

  it("shows a field error from a 400 response", async () => {
    server.use(
      mock.post("/api/projects/1/campaigns", () =>
        HttpResponse.json(
          { error: { message: "Validation error", details: [{ path: ["name"], message: "name is required" }] } },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<CampaignFormDialog projectId="1" onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText("Имя"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("name is required")).toBeInTheDocument();
  });
});
