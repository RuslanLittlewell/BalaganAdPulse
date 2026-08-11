import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "../../../../test/utils.js";
import { CampaignTabs } from "./CampaignTabs.js";
import type { CampaignSummary } from "../../data/api.js";

const campaigns: CampaignSummary[] = [
  { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
  { id: "c2", clientId: "1", name: "Display", position: 1, createdAt: "", updatedAt: "" },
];

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("CampaignTabs", () => {
  it("renders a tab per campaign and marks the active one", () => {
    renderWithProviders(
      <CampaignTabs
        clientId="1"
        campaigns={campaigns}
        activeCampaignId="c2"
        onNew={() => {}}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Display" })).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to the campaign route on select", async () => {
    renderWithProviders(
      <>
        <CampaignTabs
          clientId="1"
          campaigns={campaigns}
          activeCampaignId="c1"
          onNew={() => {}}
          onRename={() => {}}
          onDelete={() => {}}
        />
        <LocationProbe />
      </>,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Display" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/clients/1/campaigns/c2");
  });

  it("calls onNew from the add button", async () => {
    const onNew = vi.fn();
    renderWithProviders(
      <CampaignTabs
        clientId="1"
        campaigns={campaigns}
        activeCampaignId="c1"
        onNew={onNew}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "+ New sheet" }));

    expect(onNew).toHaveBeenCalled();
  });

  it("calls onRename with the active campaign id", async () => {
    const onRename = vi.fn();
    renderWithProviders(
      <CampaignTabs
        clientId="1"
        campaigns={campaigns}
        activeCampaignId="c2"
        onNew={() => {}}
        onRename={onRename}
        onDelete={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Rename sheet" }));

    expect(onRename).toHaveBeenCalledWith("c2");
  });

  it("calls onDelete with the active campaign id", async () => {
    const onDelete = vi.fn();
    renderWithProviders(
      <CampaignTabs
        clientId="1"
        campaigns={campaigns}
        activeCampaignId="c2"
        onNew={() => {}}
        onRename={() => {}}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete sheet" }));

    expect(onDelete).toHaveBeenCalledWith("c2");
  });

  it("offers no delete control when the client has a single sheet", () => {
    renderWithProviders(
      <CampaignTabs
        clientId="1"
        campaigns={[campaigns[0]]}
        activeCampaignId="c1"
        onNew={() => {}}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Rename sheet" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete sheet" })).not.toBeInTheDocument();
  });
});
