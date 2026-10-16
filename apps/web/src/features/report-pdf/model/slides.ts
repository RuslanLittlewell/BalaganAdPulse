import { t, type MessageKey } from "@/shared/config/index.js";
import type { Currency } from "@/shared/lib/index.js";
import { formatMoney, monthTitle, type Report } from "@/entities/report/index.js";
import { toBlocks, type Block } from "./rich-text.js";

export interface ChartPoint {
  label: string;
  value: number | null;
  caption: string;
}

export type Slide =
  | { kind: "cover"; client: string; period: string; pictureKey: string | null }
  | { kind: "summary"; direction: string; spend: string; budgetNote: string; leads: string; cost: string; contacts: string | null }
  | { kind: "trends"; leads: ChartPoint[]; cost: ChartPoint[] }
  | { kind: "ad"; adId: string; name: string; result: string }
  | { kind: "text"; title: string; blocks: Block[] };

export const COVER_PICTURE = "cover";

export interface ReportDeck {
  fileName: string;
  slides: Slide[];
}

const plural = new Intl.PluralRules("ru-RU");

function counted(count: number, stem: "lead" | "contact"): string {
  const form = plural.select(count);
  const key = `report.pdf.${stem}.${form === "one" ? "one" : form === "few" ? "few" : "many"}` as MessageKey;
  return `${count} ${t(key)}`;
}

const shortMonth = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("ru-RU", { month: "long", timeZone: "UTC" });

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function buildDeck(input: {
  report: Report;
  projectName: string;
  clientName: string;
  currency: Currency;
}): ReportDeck {
  const { report, projectName, clientName, currency } = input;
  const money = (amount: string | null) => formatMoney(amount, currency);
  const client = clientName || projectName;
  const slides: Slide[] = [
    {
      kind: "cover",
      client,
      period: monthTitle(report.month).toLowerCase(),
      pictureKey: report.hasCover ? COVER_PICTURE : report.ads[0]?.adId ?? null,
    },
    {
      kind: "summary",
      direction: `${t("report.pdf.direction")}${projectName}`,
      spend: money(report.spend),
      budgetNote: `${t("report.pdf.budget")} ${shortMonth(report.month)}`,
      leads: counted(report.leads, "lead"),
      cost: `${t("report.pdf.cost")}${money(report.costPerLead)}`,
      contacts: report.messengerContacts ? `+ ${counted(report.messengerContacts, "contact")}` : null,
    },
    {
      kind: "trends",
      leads: report.trend.map((point) => ({ label: String(point.leads), value: point.leads, caption: capitalized(shortMonth(point.month)) })),
      cost: report.trend.map((point) => ({
        label: money(point.costPerLead),
        value: point.costPerLead === null ? null : Number(point.costPerLead),
        caption: capitalized(shortMonth(point.month)),
      })),
    },
    ...report.ads.map((ad): Slide => ({
      kind: "ad",
      adId: ad.adId,
      name: ad.name,
      result: ad.leads === 0
        ? t("report.ads.noLeads")
        : `${counted(ad.leads, "lead")} ${t("report.pdf.at")} ${money(ad.costPerLead)}`,
    })),
  ];
  const conclusions = toBlocks(report.conclusions);
  if (conclusions.length > 0) slides.push({ kind: "text", title: t("report.pdf.conclusions"), blocks: conclusions });
  const plan = toBlocks(report.plan);
  if (plan.length > 0) slides.push({ kind: "text", title: t("report.pdf.plan"), blocks: plan });

  return {
    fileName: `${t("report.pdf.file")} ${client} _ ${monthTitle(report.month)}.pdf`,
    slides,
  };
}
