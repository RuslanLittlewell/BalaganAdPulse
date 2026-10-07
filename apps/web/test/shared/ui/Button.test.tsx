import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Link } from "react-router-dom";
import { Button } from "@/shared/ui/index.js";

describe("Button", () => {
  it("keeps its name and runs its action with the light layer in place", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Сохранить</Button>);
    const button = screen.getByRole("button", { name: "Сохранить" });

    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
    expect(button).toHaveAccessibleName("Сохранить");
  });

  it("stays still while disabled", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Сохранить</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("lends itself to a link, whatever its variant", () => {
    render(
      <MemoryRouter>
        <Button asChild variant="outline">
          <Link to="/reports">Отчёты</Link>
        </Button>
        <Button asChild>
          <Link to="/crm">CRM</Link>
        </Button>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Отчёты" })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: "CRM" })).toHaveAttribute("href", "/crm");
  });
});
