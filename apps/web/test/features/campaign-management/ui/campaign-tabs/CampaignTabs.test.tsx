import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "@test/shared/index.js";
import { CampaignTabs } from "@/features/campaign-management/ui/campaign-tabs/CampaignTabs.js";
import type { CampaignSummary } from "@/entities/campaign/index.js";

const campaigns: CampaignSummary[] = [
  { id: "c1", projectId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
  { id: "c2", projectId: "1", name: "Display", position: 1, createdAt: "", updatedAt: "" },
];

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("CampaignTabs", () => {
  it("renders a tab per campaign and marks the active one", () => {
    renderWithProviders(
      <CampaignTabs
        projectId="1"
        campaigns={campaigns}
        activeCampaignId="c2"
        onNew={() => {}}
        onRename={() => {}}
      />,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Display" })).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to the campaign route on select", async () => {
    renderWithProviders(
      <>
        <CampaignTabs
          projectId="1"
          campaigns={campaigns}
          activeCampaignId="c1"
          onNew={() => {}}
          onRename={() => {}}
        />
        <LocationProbe />
      </>,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Display" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/projects/1/campaigns/c2");
  });

  it("calls onNew from the add button", async () => {
    const onNew = vi.fn();
    renderWithProviders(
      <CampaignTabs
        projectId="1"
        campaigns={campaigns}
        activeCampaignId="c1"
        onNew={onNew}
        onRename={() => {}}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "+ Новый лист" }));

    expect(onNew).toHaveBeenCalled();
  });

  it("calls onRename with the active campaign id", async () => {
    const onRename = vi.fn();
    renderWithProviders(
      <CampaignTabs
        projectId="1"
        campaigns={campaigns}
        activeCampaignId="c2"
        onNew={() => {}}
        onRename={onRename}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Переименовать лист" }));

    expect(onRename).toHaveBeenCalledWith("c2");
  });

  it("offers only renaming on a tab: deleting lives in the dialog", async () => {
    renderWithProviders(
      <CampaignTabs
        projectId="1"
        campaigns={campaigns}
        activeCampaignId="c2"
        onNew={() => {}}
        onRename={() => {}}
      />,
    );

    expect(await screen.findByRole("button", { name: "Переименовать лист" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить лист" })).not.toBeInTheDocument();
  });

  it("offers no delete control when the client has a single sheet", async () => {
    renderWithProviders(
      <CampaignTabs
        projectId="1"
        campaigns={[campaigns[0]]}
        activeCampaignId="c1"
        onNew={() => {}}
        onRename={() => {}}
      />,
    );

    expect(await screen.findByRole("button", { name: "Переименовать лист" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить лист" })).not.toBeInTheDocument();
  });
});
