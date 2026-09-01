import { render, screen } from "@testing-library/react";
import { SectionLabel } from "@/shared/ui/SectionLabel/SectionLabel.js";

describe("SectionLabel", () => {
  it("renders its text", () => {
    render(<SectionLabel>Clients</SectionLabel>);
    expect(screen.getByText("Clients")).toBeInTheDocument();
  });
});
