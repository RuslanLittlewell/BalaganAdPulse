import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CenteredPanel } from "@/shared/ui/CenteredPanel/CenteredPanel.js";

describe("CenteredPanel", () => {
  it("renders its title as a heading", () => {
    render(<CenteredPanel title="Вход">body</CenteredPanel>);
    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  it("renders its children", () => {
    render(<CenteredPanel title="Вход"><p>body</p></CenteredPanel>);
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  describe("the theme toggle beside the title", () => {
    beforeEach(() => {
      localStorage.removeItem("adpulse.theme");
      document.documentElement.classList.remove("dark");
    });

    it("sits in the panel's header with the title", () => {
      render(<CenteredPanel title="Вход">body</CenteredPanel>);

      const header = screen.getByRole("heading", { name: "Вход" }).closest("[data-slot=card-header]") as HTMLElement;
      expect(within(header).getByRole("button", { name: "Включить тёмную тему" })).toBeInTheDocument();
    });

    it("switches the colour scheme and remembers it", async () => {
      render(<CenteredPanel title="Вход">body</CenteredPanel>);

      await userEvent.click(screen.getByRole("button", { name: "Включить тёмную тему" }));

      expect(document.documentElement).toHaveClass("dark");
      expect(localStorage.getItem("adpulse.theme")).toBe("dark");
      expect(screen.getByRole("button", { name: "Включить светлую тему" })).toBeInTheDocument();
    });
  });
});
