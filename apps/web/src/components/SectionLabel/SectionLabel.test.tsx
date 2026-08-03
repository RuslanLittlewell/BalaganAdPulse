import { render, screen } from "@testing-library/react";
import { SectionLabel } from "./SectionLabel.js";

describe("SectionLabel", () => {
  it("renders its text", () => {
    render(<SectionLabel>Clients</SectionLabel>);
    expect(screen.getByText("Clients")).toBeInTheDocument();
  });
});
