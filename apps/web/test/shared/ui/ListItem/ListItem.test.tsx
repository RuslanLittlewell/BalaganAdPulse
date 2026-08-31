import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListItem } from "@/shared/ui/ListItem/ListItem.js";

describe("ListItem", () => {
  it("renders leading content and children", () => {
    render(<ListItem leading={<span>L</span>}>Acme</ListItem>);
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("reflects the selected state", () => {
    render(<ListItem selected>Acme</ListItem>);
    expect(screen.getByRole("button", { name: /Acme/ })).toHaveAttribute("data-selected", "true");
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<ListItem onClick={onClick}>Acme</ListItem>);
    await userEvent.click(screen.getByRole("button", { name: /Acme/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows no edit control unless one is asked for", () => {
    render(<ListItem>Acme</ListItem>);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("names the edit control, so a list of rows is not a list of identical buttons", () => {
    render(<ListItem onEdit={() => {}} editLabel="Редактировать: Acme">Acme</ListItem>);
    expect(screen.getByRole("button", { name: "Редактировать: Acme" })).toBeInTheDocument();
  });

  it("fires onEdit without also firing the row's own click", async () => {
    const onClick = vi.fn();
    const onEdit = vi.fn();
    render(
      <ListItem onClick={onClick} onEdit={onEdit} editLabel="Редактировать: Acme">
        Acme
      </ListItem>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Редактировать: Acme" }));

    expect(onEdit).toHaveBeenCalledOnce();
    // The two are siblings, not nested, so the click does not bubble into the row.
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the row reachable by keyboard", async () => {
    const onClick = vi.fn();
    render(<ListItem onClick={onClick}>Acme</ListItem>);

    await userEvent.tab();
    expect(screen.getByRole("button", { name: /Acme/ })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("counts a click on the leading picture as a click on the row", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <ListItem onClick={onClick} leading={<img src="logo.png" alt="Acme" />}>
        Acme
      </ListItem>,
    );

    // Hidden from assistive tech, so it has no role to query by — reach for the
    // element itself, which is what a pointer would hit.
    await userEvent.click(container.querySelector("img")!);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("names the row by its text alone, not by the picture beside it", () => {
    render(
      <ListItem onClick={() => {}} leading={<img src="logo.png" alt="Acme" />}>
        Acme
      </ListItem>,
    );

    // The picture is hidden from assistive tech: it shows the very thing the
    // text names, and would otherwise be read twice.
    expect(screen.getByRole("button", { name: "Acme" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Acme" })).not.toBeInTheDocument();
  });

  it("draws no stripe unless one is asked for", () => {
    const { container } = render(<ListItem>Acme</ListItem>);
    expect(container.firstElementChild).toHaveStyle({ borderLeftColor: "" });
  });

  it("draws the marker down the leading edge and under the row", () => {
    const { container } = render(
      <ListItem marker="rgb(220, 38, 38)" markerLabel="Приоритет: Очень важно">
        Acme
      </ListItem>,
    );

    expect(container.firstElementChild).toHaveStyle({
      borderLeftColor: "rgb(220, 38, 38)",
      borderBottomColor: "rgb(220, 38, 38)",
    });
  });

  it("keeps the borders reserved when there is no marker, so rows stay level", () => {
    const { container } = render(<ListItem>Acme</ListItem>);
    const row = container.firstElementChild!;

    // Same box either way — only the colour is missing.
    expect(row).toHaveClass("border-b");
    expect(row).toHaveClass("border-l-4");
    expect(row).toHaveClass("border-transparent");
  });

  it("says what the stripe means, since a colour says nothing out loud", () => {
    render(
      <ListItem marker="rgb(220, 38, 38)" markerLabel="Приоритет: Очень важно">
        Acme
      </ListItem>,
    );

    expect(screen.getByText("Приоритет: Очень важно")).toHaveClass("sr-only");
  });

  it("keeps the edit control out of sight until the row is hovered", () => {
    render(<ListItem onEdit={() => {}} editLabel="Редактировать: Acme">Acme</ListItem>);

    const edit = screen.getByRole("button", { name: "Редактировать: Acme" });
    expect(edit).toHaveClass("opacity-0");
    expect(edit).toHaveClass("group-hover:opacity-100");
  });

  it("brings it back on keyboard focus, so tabbing never lands on nothing", async () => {
    const onEdit = vi.fn();
    render(
      <ListItem onClick={() => {}} onEdit={onEdit} editLabel="Редактировать: Acme">
        Acme
      </ListItem>,
    );

    const edit = screen.getByRole("button", { name: "Редактировать: Acme" });
    expect(edit).toHaveClass("focus-visible:opacity-100");

    // Second stop: the row itself, then the pencil.
    await userEvent.tab();
    await userEvent.tab();
    expect(edit).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
