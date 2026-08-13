import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableCell } from "./EditableCell.js";

/** Mirrors the parent's job: it owns which cell is open. */
function Harness({
  onSave = () => Promise.resolve(),
  onClose,
}: {
  onSave?: (raw: string) => Promise<void>;
  onClose?: (direction?: 1 | -1) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <EditableCell
      display="120.00"
      value="120"
      label="SPEND, 01 Aug"
      editing={editing}
      onOpen={() => setEditing(true)}
      onClose={(direction) => {
        setEditing(false);
        onClose?.(direction);
      }}
      onSave={onSave}
    />
  );
}

/**
 * Two cells sharing one open position, the way a real grid's parent does: closing
 * with a direction moves the open cell to the neighbour instead of clearing it.
 */
function TwoCellHarness() {
  const [editing, setEditing] = useState<0 | 1 | null>(null);
  return (
    <>
      <EditableCell
        display="120.00"
        value="120"
        label="SPEND, 01 Aug"
        editing={editing === 0}
        onOpen={() => setEditing(0)}
        onClose={(direction) => setEditing(direction === 1 ? 1 : null)}
        onSave={() => Promise.resolve()}
      />
      <EditableCell
        display="60.00"
        value="60"
        label="SPEND, 02 Aug"
        editing={editing === 1}
        onOpen={() => setEditing(1)}
        onClose={(direction) => setEditing(direction === -1 ? 0 : null)}
        onSave={() => Promise.resolve()}
      />
    </>
  );
}

describe("EditableCell", () => {
  it("shows the formatted value at rest and opens an input with the raw value", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));

    expect(screen.getByRole("textbox", { name: "SPEND, 01 Aug" })).toHaveValue("120");
  });

  it("opens an input that cannot widen the column it sits in", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));

    // An input defaults to an intrinsic width of 20 characters. Inside an auto-layout
    // table that intrinsic width becomes the column's content width — a percentage
    // width cannot override it — so the column jumps wider the moment a cell opens.
    expect(screen.getByRole("textbox", { name: "SPEND, 01 Aug" })).toHaveAttribute("size", "1");
  });

  it("keeps the resting text in the layout while editing, so the column keeps its width", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));

    // A column is only as wide as what sits in its cells. The input contributes one
    // character, so without this the column would collapse to the header's width the
    // moment a cell with long content opened. The text stays in flow, hidden, and the
    // input is laid over it — hidden from assistive tech, which reads the input instead.
    const ghost = screen.getByText("120.00");
    expect(ghost).toBeInTheDocument();
    expect(ghost).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: "120.00" })).not.toBeInTheDocument();
  });

  it("saves on Enter", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Enter}");

    expect(onSave).toHaveBeenCalledWith("200");
  });

  it("returns focus to the resting button after saving on Enter", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Enter}");

    const cell = await screen.findByRole("button", { name: "120.00" });
    expect(document.activeElement).toBe(cell);
  });

  it("saves when the cell loses focus", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200");
    // Clicking away, not tabbing: `userEvent.tab()` would fire the Tab key handler and
    // this case has to exercise the blur path on its own.
    await userEvent.click(document.body);

    expect(onSave).toHaveBeenCalledWith("200");
  });

  it("discards the edit on Escape", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Escape}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "120.00" })).toBeInTheDocument();
  });

  it("returns focus to the resting button after discarding on Escape", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Escape}");

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "120.00" }));
  });

  it("saves nothing when the value was not changed", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
  });

  it("reports the direction when the user tabs out", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Tab}");

    expect(onClose).toHaveBeenCalledWith(1);
  });

  it("reports the other direction on Shift+Tab", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Shift>}{Tab}{/Shift}");

    expect(onClose).toHaveBeenCalledWith(-1);
  });

  it("shows the typed value while the save is in flight", async () => {
    let release = () => {};
    const onSave = () => new Promise<void>((resolve) => { release = resolve; });
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Enter}");

    const cell = screen.getByRole("button", { name: "200" });
    expect(cell).toHaveAttribute("data-state", "saving");
    release();
    await waitFor(() => expect(screen.getByRole("button", { name: "120.00" })).toBeInTheDocument());
  });

  it("shows the rejection reason and restores the stored value", async () => {
    const onSave = () => Promise.reject(new Error("Enter a number"));
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("abc{Enter}");

    const cell = await screen.findByRole("button", { name: "120.00" });
    expect(cell).toHaveAttribute("data-state", "error");
    expect(cell).toHaveAttribute("title", "Enter a number");
  });

  it("reopens a failed cell with the text last typed and clears the error", async () => {
    const onSave = vi.fn(() => Promise.reject(new Error("Enter a number")));
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("abc{Enter}");
    await screen.findByRole("button", { name: "120.00" });
    await userEvent.click(screen.getByRole("button", { name: "120.00" }));

    expect(screen.getByRole("textbox", { name: "SPEND, 01 Aug" })).toHaveValue("abc");
  });

  it("does not steal focus back when Tab opens the neighbouring cell", async () => {
    render(<TwoCellHarness />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Tab}");

    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "SPEND, 02 Aug" }));
  });
});
