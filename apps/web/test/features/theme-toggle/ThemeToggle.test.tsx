import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/features/theme-toggle/ThemeToggle.js";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("switches between light and dark themes", async () => {
    render(<ThemeToggle />);
    const toggle = screen.getByRole("button", { name: "Включить тёмную тему" });

    await userEvent.click(toggle);
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Включить светлую тему" })).toBeInTheDocument();
  });

  it("remembers the choice", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Включить тёмную тему" }));
    expect(localStorage.getItem("adpulse.theme")).toBe("dark");
  });

  it("switches back", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Включить тёмную тему" }));
    await userEvent.click(screen.getByRole("button", { name: "Включить светлую тему" }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Включить тёмную тему" })).toBeInTheDocument();
  });

  it("starts from the operating system's preference", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Включить светлую тему" })).toBeInTheDocument();
  });

  it("draws exactly one icon, and hides it from assistive tech", () => {
    const { container } = render(<ThemeToggle />);
    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveAttribute("aria-hidden", "true");
  });
});
