import { render, screen } from "@testing-library/react";
import { CenteredPanel } from "@/shared/ui/index.js";

describe("CenteredPanel", () => {
  it("is narrow by default, the width a single column of fields wants", () => {
    render(<CenteredPanel title="Вход"><p>form</p></CenteredPanel>);

    expect(screen.getByText("form").closest("[data-slot='card']")!.className)
      .toContain("420px");
  });

  it("widens on request", () => {
    render(<CenteredPanel title="Регистрация" wide><p>form</p></CenteredPanel>);

    const card = screen.getByText("form").closest("[data-slot='card']")!;
    expect(card.className).not.toContain("420px");
    expect(card.className).toContain("760px");
  });
});
