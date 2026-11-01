import { t } from "@/shared/config/index.js";
import type { Creative } from "@/entities/campaign/index.js";

const linesOf = (text: string | null) => (text ?? "").split("\n").filter((line) => line.trim() !== "");

function Section({ heading, lines }: { heading: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <section className="grid gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">{heading}</h3>
      <ul className="m-0 grid list-none gap-1 p-0 text-sm text-foreground">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export function CreativeText({ creative }: { creative: Creative }) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3">
      <Section heading={t("creatives.headlines")} lines={linesOf(creative.title)} />
      <Section heading={t("creatives.descriptions")} lines={linesOf(creative.body)} />
    </div>
  );
}
