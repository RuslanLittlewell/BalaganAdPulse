import { render, screen } from "@testing-library/react";
import { MetricCard } from "@/shared/ui/index.js";

describe("MetricCard", () => {
  it("shows the figure under its name", () => {
    render(<MetricCard label="Расход" value="1 000 ₽" />);

    expect(screen.getByText("Расход")).toBeInTheDocument();
    expect(screen.getByText("1 000 ₽")).toBeInTheDocument();
  });

  it("shows a supporting figure beside it", () => {
    render(<MetricCard label="Расход" value="1 000 ₽" hint="CPC 0,50 ₽" />);

    expect(screen.getByText("CPC 0,50 ₽")).toBeInTheDocument();
  });
});
