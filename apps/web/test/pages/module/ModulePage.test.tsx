import { render, screen } from "@testing-library/react";
import { ModulePage } from "@/pages/module/ModulePage.js";

describe("ModulePage", () => {
  it("names the module and says plainly that it is not built yet", () => {
    render(<ModulePage title="Отчёты" />);
    expect(screen.getByRole("heading", { name: "Отчёты" })).toBeInTheDocument();
    expect(screen.getByText("Модуль в разработке")).toBeInTheDocument();
    expect(screen.getByText("Этот раздел ещё не реализован.")).toBeInTheDocument();
  });
});
