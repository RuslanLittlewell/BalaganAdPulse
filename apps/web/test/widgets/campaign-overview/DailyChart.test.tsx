import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MeasuredDay } from "@/entities/campaign/index.js";
import { DailyChart } from "@/widgets/campaign-overview/DailyChart.js";

const days: MeasuredDay[] = [1, 2, 3].map((day) => ({
  date: `2026-09-0${day}`,
  spend: day * 100,
  conversions: day * 2,
  impressions: 0, reach: 0, clicks: 0, revenue: 0,
}));

function chartWithWidth(width = 360) {
  const chart = screen.getByRole("group", { name: "Динамика по дням" });
  vi.spyOn(chart, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 0, width, 176));
  return chart;
}

function move(chart: HTMLElement, clientX: number) {
  fireEvent(chart, new MouseEvent("pointermove", { bubbles: true, clientX }));
}

describe("DailyChart interaction", () => {
  it("selects the nearest day at the rendered chart width and shows its values", () => {
    render(<DailyChart days={days} currency="EUR" />);
    const chart = chartWithWidth();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    move(chart, 280);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("2 сентября 2026");
    expect(within(tooltip).getByText(/200\s+€/)).toBeInTheDocument();
    expect(within(tooltip).getByText("4")).toBeInTheDocument();
    move(chart, 90);
    expect(tooltip).toHaveTextContent("1 сентября 2026");
    move(chart, 470);
    expect(tooltip).toHaveTextContent("3 сентября 2026");
    fireEvent.pointerLeave(chart);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation and dismissal", () => {
    render(<DailyChart days={days} />);
    const chart = chartWithWidth();
    fireEvent.focus(chart);
    expect(screen.getByRole("tooltip")).toHaveTextContent("1 сентября 2026");
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("2 сентября 2026");
    fireEvent.keyDown(chart, { key: "End" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("3 сентября 2026");
    fireEvent.keyDown(chart, { key: "Home" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("1 сентября 2026");
    fireEvent.keyDown(chart, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("handles a single zero-valued day and hides the old selection after a period change", () => {
    const { rerender } = render(<DailyChart days={[{ ...days[0], spend: 0, conversions: 0 }]} />);
    const chart = chartWithWidth(200);
    fireEvent(chart, new MouseEvent("pointerdown", { bubbles: true, clientX: 280 }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("1 сентября 2026");
    expect(within(screen.getByRole("tooltip")).getByText(/0\s+₽/)).toBeInTheDocument();
    rerender(<DailyChart days={[days[2]]} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    rerender(<DailyChart days={[]} />);
    expect(screen.getByText("За период нет данных")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
