import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Loader } from "./Loader.js";

describe("Loader", () => {
  it("shows the default label", () => {
    render(<Loader />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows a given label", () => {
    render(<Loader label="Signing in…" />);
    expect(screen.getByText("Signing in…")).toBeInTheDocument();
  });

  it("announces itself as a status", () => {
    render(<Loader />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("carries the size as a data attribute", () => {
    render(<Loader size="sm" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-size", "sm");
  });
});
