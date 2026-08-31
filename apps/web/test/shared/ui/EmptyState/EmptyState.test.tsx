import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/shared/ui/EmptyState/EmptyState.js";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="Выберите клиента" description="Add one from the sidebar" />);
    expect(screen.getByText("Выберите клиента")).toBeInTheDocument();
    expect(screen.getByText("Add one from the sidebar")).toBeInTheDocument();
  });

  it("renders an action below the description", () => {
    render(<EmptyState title="Что-то пошло не так" action={<button type="button">Повторить</button>} />);

    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});
