import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import {
  SelectionSync,
  parseSelection,
  useActiveCampaignId,
  useActiveProjectId,
  useSelectionStore,
} from "@/entities/project/index.js";

describe("parseSelection", () => {
  it("reads a project and a sheet out of the address", () => {
    expect(parseSelection("/projects/p1/campaigns/c1")).toEqual({
      projectId: "p1",
      campaignId: "c1",
    });
  });

  it("reads a project on its own", () => {
    expect(parseSelection("/projects/p1")).toEqual({ projectId: "p1", campaignId: undefined });
  });

  it("selects nothing outside the projects module", () => {
    expect(parseSelection("/tasks")).toEqual({});
    expect(parseSelection("/")).toEqual({});
    expect(parseSelection("/projects")).toEqual({});
  });
});

function Probe() {
  const projectId = useActiveProjectId();
  const campaignId = useActiveCampaignId();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="selection">{`${projectId ?? "—"}/${campaignId ?? "—"}`}</p>
      <button type="button" onClick={() => navigate("/projects/p2/campaigns/c9")}>
        go
      </button>
    </>
  );
}

function renderAt(route: string) {
  useSelectionStore.setState({ projectId: undefined, campaignId: undefined });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SelectionSync />
      <Routes>
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SelectionSync", () => {
  it("fills the store from the address a visitor arrived on", () => {
    renderAt("/projects/p1/campaigns/c1");
    expect(screen.getByTestId("selection")).toHaveTextContent("p1/c1");
  });

  it("follows a navigation", async () => {
    renderAt("/projects/p1/campaigns/c1");
    await userEvent.click(screen.getByRole("button", { name: "go" }));
    expect(screen.getByTestId("selection")).toHaveTextContent("p2/c9");
  });

  it("clears the sheet when the address no longer names one", () => {
    useSelectionStore.setState({ projectId: "p1", campaignId: "c1" });
    render(
      <MemoryRouter initialEntries={["/projects/p1"]}>
        <SelectionSync />
        <Probe />
      </MemoryRouter>,
    );
    // A merge would have left c1 behind, pointing at a sheet of another project.
    expect(screen.getByTestId("selection")).toHaveTextContent("p1/—");
  });

  it("empties the selection outside the projects module", () => {
    useSelectionStore.setState({ projectId: "p1", campaignId: "c1" });
    render(
      <MemoryRouter initialEntries={["/tasks"]}>
        <SelectionSync />
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("selection")).toHaveTextContent("—/—");
  });
});
