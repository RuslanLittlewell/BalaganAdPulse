import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../../../../test/server.js";
import { renderWithProviders } from "../../../../test/utils.js";
import { CampaignFormDialog } from "./CampaignFormDialog.js";

const campaign = {
  id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "",
};

describe("CampaignFormDialog", () => {
  it("creates a sheet and reports the created campaign", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/clients/1/campaigns", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ ...campaign, id: "c9", name: "Display" }, { status: 201 });
      }),
    );
    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderWithProviders(
      <CampaignFormDialog clientId="1" onClose={onClose} onCreated={onCreated} />,
    );

    await userEvent.type(screen.getByLabelText("Name"), "  Display  ");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(received).toEqual({ name: "Display" });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "c9" }));
  });

  it("disables Create until a name is entered", async () => {
    renderWithProviders(<CampaignFormDialog clientId="1" onClose={() => {}} />);

    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Name"), "Display");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
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
      <CampaignFormDialog clientId="1" campaign={campaign} onClose={onClose} />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Search ads");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(method).toBe("PATCH");
  });

  it("shows a field error from a 400 response", async () => {
    server.use(
      mock.post("/api/clients/1/campaigns", () =>
        HttpResponse.json(
          { error: { message: "Validation error", details: [{ path: ["name"], message: "name is required" }] } },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<CampaignFormDialog clientId="1" onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("name is required")).toBeInTheDocument();
  });
});
