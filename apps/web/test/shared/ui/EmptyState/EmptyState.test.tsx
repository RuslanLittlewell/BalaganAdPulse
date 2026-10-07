import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "@/shared/ui/EmptyState/EmptyState.js";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="Выберите клиента" description="Add one from the sidebar" />);
    expect(screen.getByText("Выберите клиента")).toBeInTheDocument();
    expect(screen.getByText("Add one from the sidebar")).toBeInTheDocument();
  });

  it("offers its action as a button below the description and runs it", async () => {
    const onAction = vi.fn();
    render(<EmptyState title="Что-то пошло не так" actionLabel="Повторить" onAction={onAction} />);

    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it("shows no button when it is given no action", () => {
    render(<EmptyState title="Что-то пошло не так" actionLabel="Повторить" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
