import { useState } from "react";
import { Moon, Sun } from "lucide";
import { MorphIcon } from "morphicons/react";
import { getPreferredTheme, setTheme, type Theme } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button } from "@/shared/ui/index.js";

export function ThemeToggle() {
  const [theme, updateTheme] = useState<Theme>(getPreferredTheme);
  const nextTheme = theme === "light" ? "dark" : "light";
  const label = nextTheme === "dark" ? t("theme.toDark") : t("theme.toLight");

  function toggleTheme() {
    setTheme(nextTheme);
    updateTheme(nextTheme);
  }

  return (
    <Button variant="ghost" size="icon" aria-label={label} onClick={toggleTheme}>
      {/* Shows the theme it switches to. The two shapes are not congruent, so
          morphicons morphs rather than rotates — the sun's rays grow out of the
          crescent instead of the icons swapping. */}
      <MorphIcon icon={theme === "light" ? Moon : Sun} size={18} spring="snappy" />
    </Button>
  );
}
