import type { ComponentProps } from "react";
import { cn, useTheme, type Theme } from "@/shared/lib/index.js";
import { Button as BaseButton } from "../ui/button.js";
import { Specular } from "../Specular/index.js";

type Variant = NonNullable<ComponentProps<typeof BaseButton>["variant"]>;

const ACCENT: Record<Theme, string> = { light: "#0F766E", dark: "#c4a074" };

const SHINE: Partial<Record<Variant, (theme: Theme) => string>> = {
  default: () => "#ffffff",
  destructive: () => "#ffffff",
  secondary: (theme) => ACCENT[theme],
  outline: (theme) => ACCENT[theme],
};

export function Button({
  className,
  children,
  variant = "default",
  asChild = false,
  ...props
}: ComponentProps<typeof BaseButton>) {
  const theme = useTheme();
  const shine = asChild ? undefined : SHINE[variant ?? "default"];

  return (
    <BaseButton
      variant={variant}
      asChild={asChild}
      className={cn(shine && "relative", className)}
      {...props}
    >
      {shine ? (
        <>
          <Specular lineColor={shine(theme)} />
          {children}
        </>
      ) : (
        children
      )}
    </BaseButton>
  );
}
