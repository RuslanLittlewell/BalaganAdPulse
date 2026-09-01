import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CenteredPanel } from "@/shared/ui/CenteredPanel/CenteredPanel.js";

describe("CenteredPanel", () => {
  it("renders its title as a heading", () => {
    render(<CenteredPanel title="Вход">body</CenteredPanel>);
    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  it("renders its children", () => {
    render(<CenteredPanel title="Вход"><p>body</p></CenteredPanel>);
    expect(screen.getByText("body")).toBeInTheDocument();
  });
});
