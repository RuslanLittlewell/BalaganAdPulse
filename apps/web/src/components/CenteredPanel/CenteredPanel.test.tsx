import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CenteredPanel } from "./CenteredPanel.js";

describe("CenteredPanel", () => {
  it("renders its title as a heading", () => {
    render(<CenteredPanel title="Sign in">body</CenteredPanel>);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders its children", () => {
    render(<CenteredPanel title="Sign in"><p>body</p></CenteredPanel>);
    expect(screen.getByText("body")).toBeInTheDocument();
  });
});
