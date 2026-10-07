import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddTile } from "@/shared/ui/index.js";

describe("AddTile", () => {
  it("runs its action on click and from the keyboard", async () => {
    const onClick = vi.fn();
    render(<AddTile label="Добавить колонку" onClick={onClick} />);
    const tile = screen.getByRole("button", { name: "Добавить колонку" });

    await userEvent.click(tile);
    tile.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");

    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("does not submit the form it sits in", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <AddTile label="Добавить" onClick={() => undefined} />
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Добавить" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("stays still while disabled and hands the tile around its button to a ref", async () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLDivElement>();
    render(<AddTile ref={ref} label="Добавить" disabled onClick={onClick} />);
    const tile = screen.getByRole("button", { name: "Добавить" });

    await userEvent.click(tile);

    expect(tile).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
    expect(ref.current).toContainElement(tile);
  });
});
