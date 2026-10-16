import { renderHook, waitFor } from "@testing-library/react";
import { applyTheme, getPreferredTheme, setTheme, useTheme } from "@/shared/lib/theme.js";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("uses the saved theme before the system preference", () => {
    localStorage.setItem("adpulse.theme", "dark");
    expect(getPreferredTheme()).toBe("dark");
  });

  it("uses the system preference on the first visit", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(getPreferredTheme()).toBe("dark");
  });

  it("applies and persists a selected theme", () => {
    setTheme("dark");
    expect(localStorage.getItem("adpulse.theme")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");

    applyTheme("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });
});

describe("useTheme", () => {
  it("follows the theme as it is switched", async () => {
    setTheme("light");
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("light");

    setTheme("dark");
    await waitFor(() => expect(result.current).toBe("dark"));

    setTheme("light");
    await waitFor(() => expect(result.current).toBe("light"));
  });
});
