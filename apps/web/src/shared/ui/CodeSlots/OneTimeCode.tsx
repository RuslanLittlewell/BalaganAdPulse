import { t } from "@/shared/config/index.js";
import CodeSlots, { type CodeSlotsProps } from "./CodeSlots.js";

export type OneTimeCodeProps = Omit<
  CodeSlotsProps,
  "accentColor" | "inkColor" | "slotColor" | "digitColor" | "dangerColor" | "ariaLabel" | "acceptedLabel" | "countLabel"
> & { label: string };

export function OneTimeCode({ label, ...rest }: OneTimeCodeProps) {
  return (
    <CodeSlots
      length={6}
      slotSize={42}
      accentColor="var(--primary)"
      inkColor="var(--foreground)"
      slotColor="var(--muted)"
      digitColor="var(--primary-foreground)"
      dangerColor="var(--destructive)"
      ariaLabel={label}
      acceptedLabel={t("twoFactor.accepted")}
      countLabel={(filled, length) => `${t("twoFactor.digits")} ${filled} / ${length}`}
      {...rest}
    />
  );
}
