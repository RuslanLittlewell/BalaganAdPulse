import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { ReportDownload } from "@/features/report-pdf/index.js";
import type { Report } from "@/entities/report/index.js";

vi.mock("@/features/report-pdf/ui/render.js", () => ({
  renderDeck: vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" })),
}));

const report = {
  id: "r8", projectId: "p1", month: "2026-08", status: "PUBLISHED", currency: "USD",
  spend: "100.0000", leads: 4, costPerLead: "25.0000", previous: null, change: { leads: null, costPerLead: null },
  trend: [{ month: "2026-08", spend: "100.0000", leads: 4, costPerLead: "25.0000" }],
  ads: [{ adId: "a1", name: "Smart", spend: "100.0000", leads: 4, costPerLead: "25.0000" }],
  messengerContacts: null, hasCover: false, conclusions: null, plan: null, publishedAt: null, createdAt: "", updatedAt: "",
} satisfies Report;

describe("ReportDownload", () => {
  it("saves the rendered deck under the template's file name", async () => {
    server.use(mock.get("/api/ads/a1/creatives", () => HttpResponse.json([])));
    const saved: string[] = [];
    URL.createObjectURL = vi.fn(() => "blob:report");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    const { renderDeck } = await import("@/features/report-pdf/ui/render.js");

    renderWithProviders(<ReportDownload report={report} projectName="Окна" clientName="AURORA" currency="USD" />);
    await userEvent.click(screen.getByRole("button", { name: "Скачать PDF" }));

    await waitFor(() => expect(saved).toEqual(["Отчет AURORA _ Август 2026.pdf"]));
    expect(renderDeck).toHaveBeenCalledWith(expect.objectContaining({ fileName: "Отчет AURORA _ Август 2026.pdf" }), new Map());
    expect(screen.getByRole("button", { name: "Скачать PDF" })).toBeEnabled();
    click.mockRestore();
  });
});
