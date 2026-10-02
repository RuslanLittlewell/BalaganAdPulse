import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RubberSegment } from "@/shared/ui/RubberSegment/RubberSegment.js";

const items = [
  { value: "board", label: "Board" },
  { value: "calendar", label: "Calendar" },
];

describe("RubberSegment", () => {
  it("renders one radio per item inside a labelled group and marks the selected one", () => {
    render(<RubberSegment items={items} value="calendar" onChange={() => {}} aria-label="View" />);

    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Calendar" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Board" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the value and index of a clicked option", async () => {
    const onChange = vi.fn();
    render(<RubberSegment items={items} value="board" onChange={onChange} aria-label="View" />);

    await userEvent.click(screen.getByRole("radio", { name: "Calendar" }));

    expect(onChange).toHaveBeenCalledWith("calendar", 1);
  });

  it("moves the selection with the arrow keys and focuses the newly selected option", async () => {
    const onChange = vi.fn();
    render(<RubberSegment items={items} value="board" onChange={onChange} aria-label="View" />);

    screen.getByRole("radio", { name: "Board" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("calendar", 1);
    expect(screen.getByRole("radio", { name: "Calendar" })).toHaveFocus();
  });

  it("jumps to the last option with End and back to the first with Home", async () => {
    const onChange = vi.fn();
    render(<RubberSegment items={items} defaultValue="board" onChange={onChange} aria-label="View" />);

    screen.getByRole("radio", { name: "Board" }).focus();
    await userEvent.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("calendar", 1);

    await userEvent.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("board", 0);
  });

  it("selects the option the indicator is dragged onto", async () => {
    const onChange = vi.fn();
    const rects: Record<string, DOMRect> = {
      group: { left: 0, right: 200, top: 0, bottom: 40, width: 200, height: 40 } as DOMRect,
      board: { left: 3, right: 97, top: 3, bottom: 37, width: 94, height: 34 } as DOMRect,
      calendar: { left: 103, right: 197, top: 3, bottom: 37, width: 94, height: 34 } as DOMRect,
    };
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.getAttribute("role") === "radiogroup") return rects.group;
      const name = this.textContent === "Board" ? "board" : "calendar";
      return rects[name];
    });

    render(<RubberSegment items={items} value="board" onChange={onChange} aria-label="View" />);

    const boardOption = screen.getByRole("radio", { name: "Board" });

    await userEvent.pointer([
      { keys: "[MouseLeft>]", target: boardOption, coords: { clientX: 50, clientY: 20 } },
      { coords: { clientX: 56, clientY: 20 } },
      { coords: { clientX: 150, clientY: 20 } },
      { keys: "[/MouseLeft]" },
    ]);

    expect(onChange).toHaveBeenCalledWith("calendar", 1);

    vi.restoreAllMocks();
  });

  it("still updates the selection when the viewer prefers reduced motion", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    const onChange = vi.fn();
    render(<RubberSegment items={items} defaultValue="board" onChange={onChange} aria-label="View" />);

    await userEvent.click(screen.getByRole("radio", { name: "Calendar" }));

    expect(onChange).toHaveBeenCalledWith("calendar", 1);
    expect(screen.getByRole("radio", { name: "Calendar" })).toHaveAttribute("aria-checked", "true");

    window.matchMedia = original;
  });
});
