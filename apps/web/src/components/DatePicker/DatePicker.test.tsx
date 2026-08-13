import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./DatePicker.js";

const labels = { dialog: "Choose a date", previousMonth: "Previous month", nextMonth: "Next month" };

interface Overrides {
  value?: string;
  rect?: Partial<DOMRect>;
  onSelect?: (iso: string) => void;
  onClose?: () => void;
}

/**
 * Mirrors how the popover is really used: a trigger the picker anchors to, plus a
 * neighbour outside both of them to click on.
 */
function setup(overrides: Overrides = {}) {
  function Harness() {
    // A callback ref in state, so the picker re-renders once the anchor exists.
    const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
    return (
      <>
        <button
          type="button"
          ref={(node) => {
            if (node != null && overrides.rect != null) {
              node.getBoundingClientRect = () => overrides.rect as DOMRect;
            }
            setAnchor(node);
          }}
        >
          trigger
        </button>
        <span>elsewhere</span>
        <DatePicker
          value={overrides.value ?? "2026-08-03"}
          anchorTo={anchor}
          labels={labels}
          onSelect={overrides.onSelect ?? (() => {})}
          onClose={overrides.onClose ?? (() => {})}
        />
      </>
    );
  }

  return render(<Harness />);
}

describe("DatePicker", () => {
  it("opens on the month of its value", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "Choose a date" })).toBeInTheDocument();
    expect(screen.getByText("August 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "03 August 2026" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the neighbouring days that fill the first and last week", () => {
    setup();

    // 1 August 2026 is a Saturday, so the grid opens on Monday 27 July.
    expect(screen.getByRole("button", { name: "27 July 2026" })).toHaveAttribute("data-outside", "true");
    expect(screen.getByRole("button", { name: "01 August 2026" })).not.toHaveAttribute("data-outside");
  });

  it("steps to the previous and the next month", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("September 2026")).toBeInTheDocument();
  });

  it("reports the day that was clicked", async () => {
    const onSelect = vi.fn();
    setup({ onSelect });

    await userEvent.click(screen.getByRole("button", { name: "12 August 2026" }));

    expect(onSelect).toHaveBeenCalledWith("2026-08-12");
  });

  it("focuses the selected day and moves focus with the arrow keys", async () => {
    setup();

    expect(screen.getByRole("button", { name: "03 August 2026" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "04 August 2026" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "11 August 2026" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}{ArrowLeft}");
    expect(screen.getByRole("button", { name: "03 August 2026" })).toHaveFocus();
  });

  it("follows the arrow keys into the next month", async () => {
    setup({ value: "2026-08-31" });

    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "01 September 2026" })).toHaveFocus();
  });

  it("selects the focused day with Enter", async () => {
    const onSelect = vi.fn();
    setup({ onSelect });

    await userEvent.keyboard("{ArrowRight}{Enter}");

    expect(onSelect).toHaveBeenCalledWith("2026-08-04");
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    setup({ onClose });

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("renders outside its anchor's subtree, so no scroll container can clip it", () => {
    const { container } = setup();

    const popover = screen.getByRole("dialog", { name: "Choose a date" });
    expect(container).not.toContainElement(popover);
    expect(popover.parentElement).toBe(document.body);
  });

  it("pins itself under the anchor in viewport coordinates", () => {
    setup({ rect: { top: 80, bottom: 100, left: 40, right: 140, width: 100, height: 20 } });

    const popover = screen.getByRole("dialog", { name: "Choose a date" });
    expect(popover).toHaveStyle({ position: "fixed", top: "104px", left: "40px" });
  });

  it("closes on a click outside the anchor and the popover", async () => {
    const onClose = vi.fn();
    setup({ onClose });

    await userEvent.click(screen.getByText("elsewhere"));

    expect(onClose).toHaveBeenCalled();
  });

  it("stays open when the calendar itself is clicked", async () => {
    const onClose = vi.fn();
    setup({ onClose });

    await userEvent.click(screen.getByRole("button", { name: "Next month" }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("leaves the trigger alone, so the click that toggles it cannot close and reopen it", async () => {
    const onClose = vi.fn();
    setup({ onClose });

    await userEvent.click(screen.getByRole("button", { name: "trigger" }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
