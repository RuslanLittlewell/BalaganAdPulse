import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { parseSelection, useActiveCampaignId, useActiveProjectId } from "@/entities/project/index.js";

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
      <button type="button" onClick={() => navigate("/crm")}>
        leave
      </button>
    </>
  );
}

function HeldAddress() {
  const [held] = useState(useLocation());
  return (
    <Routes location={held}>
      <Route path="*" element={<Probe />} />
    </Routes>
  );
}

const renderAt = (route: string, page = <Probe />) =>
  render(<MemoryRouter initialEntries={[route]}>{page}</MemoryRouter>);

describe("the active selection", () => {
  it("is read from the address a visitor arrived on", () => {
    renderAt("/projects/p1/campaigns/c1");
    expect(screen.getByTestId("selection")).toHaveTextContent("p1/c1");
  });

  it("follows a navigation", async () => {
    renderAt("/projects/p1/campaigns/c1");
    await userEvent.click(screen.getByRole("button", { name: "go" }));
    expect(screen.getByTestId("selection")).toHaveTextContent("p2/c9");
  });

  it("names no sheet when the address names none", () => {
    renderAt("/projects/p1");
    expect(screen.getByTestId("selection")).toHaveTextContent("p1/—");
  });

  it("is empty outside the projects module", () => {
    renderAt("/tasks");
    expect(screen.getByTestId("selection")).toHaveTextContent("—/—");
  });

  it("stays with a page still shown under the address it left, as one fading out does", async () => {
    renderAt("/projects/p1/campaigns/c1", <HeldAddress />);
    await userEvent.click(screen.getByRole("button", { name: "leave" }));
    expect(screen.getByTestId("selection")).toHaveTextContent("p1/c1");
  });
});
