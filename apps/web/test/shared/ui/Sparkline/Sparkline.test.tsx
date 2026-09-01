import { render, screen } from "@testing-library/react";
import { Sparkline } from "@/shared/ui/index.js";

describe("Sparkline", () => {
  it("draws the series and labels what it shows", () => {
    render(<Sparkline values={[1, 4, 2]} label="Расход по дням" />);

    const chart = screen.getByRole("img", { name: "Расход по дням" });
    expect(chart.querySelector("path")).not.toBeNull();
  });

  // Nothing measured is not a flat line at zero — it is no picture at all.
  it("draws nothing for an empty series", () => {
    render(<Sparkline values={[]} label="Расход по дням" />);

    expect(screen.queryByRole("img")).toBeNull();
  });
});
