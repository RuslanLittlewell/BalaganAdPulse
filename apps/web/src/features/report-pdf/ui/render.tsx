import { pdf } from "@react-pdf/renderer";
import type { ReportDeck } from "../model/slides.js";
import { registerReportFonts, ReportDocument } from "./ReportDocument.js";

export function renderDeck(deck: ReportDeck, pictures: ReadonlyMap<string, string>): Promise<Blob> {
  return pdf(<ReportDocument deck={deck} pictures={pictures} fonts={registerReportFonts()} />).toBlob();
}
