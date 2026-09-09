import { http as mock, HttpResponse, delay } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { CreativePreviewDialog } from "@/widgets/creative-preview/index.js";
import type { Ad, Creative } from "@/entities/campaign/index.js";

const png = new Uint8Array([137, 80, 78, 71]);
const performance = {
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0,
  ctr: 0, cpc: 0, cpm: 0, cpa: 0, roas: 0, frequency: 0,
};

const creative = (overrides: Partial<Creative> = {}): Creative => ({
  id: "cr1", position: 0, kind: "IMAGE", title: "Заголовок", body: "Текст",
  hasFile: true, hasPoster: false, ...overrides,
});

const ad = (overrides: Partial<Ad> = {}): Ad => ({
  id: "a1", adSetId: "s1", name: "Первое", format: null, headline: null,
  status: "ACTIVE", externalId: "111", position: 0,
  performance: performance as Ad["performance"], ...overrides,
});

function api(responses: Record<string, Creative[]> = { a1: [creative()] }) {
  const asked: string[] = [];
  server.use(
    mock.get("/api/ads/:id/creatives", ({ params }) => {
      asked.push(`creatives:${params.id}`);
      return HttpResponse.json(responses[String(params.id)] ?? []);
    }),
    mock.get("/api/ad-creatives/:id/file", ({ params }) => {
      asked.push(`file:${params.id}`);
      return HttpResponse.arrayBuffer(png.buffer as ArrayBuffer, {
        headers: { "content-type": "image/png" },
      });
    }),
    mock.get("/api/ad-creatives/:id/poster", ({ params }) => {
      asked.push(`poster:${params.id}`);
      return HttpResponse.arrayBuffer(png.buffer as ArrayBuffer, {
        headers: { "content-type": "image/jpeg" },
      });
    }),
  );
  return asked;
}

describe("CreativePreviewDialog", () => {
  it("fetches only the chosen ad's creative when the dialog opens", async () => {
    const asked = api({ a1: [creative()], a2: [creative({ id: "cr2" })] });
    renderWithProviders(
      <CreativePreviewDialog ads={[ad(), ad({ id: "a2", name: "Второе" })]} initialAdId="a1" onClose={() => {}} />,
    );

    expect(await screen.findByRole("dialog", { name: /Первое/ })).toBeInTheDocument();
    const image = await screen.findByAltText("Заголовок");
    await waitFor(() => expect(image).toHaveAttribute("src", expect.stringContaining("blob:")));
    expect(asked).toContain("creatives:a1");
    expect(asked).not.toContain("creatives:a2");
    expect(screen.getByText("Текст")).toBeInTheDocument();
  });

  it("fetches the next ad on navigation and reuses both cached results", async () => {
    const asked = api({
      a1: [creative()],
      a2: [creative({ id: "cr2", title: "Второй креатив" })],
    });
    const user = userEvent.setup();
    renderWithProviders(
      <CreativePreviewDialog ads={[ad(), ad({ id: "a2", name: "Второе" })]} initialAdId="a1" onClose={() => {}} />,
    );

    await screen.findByAltText("Заголовок");
    await user.click(screen.getByRole("button", { name: "Следующее объявление" }));
    expect(await screen.findByAltText("Второй креатив")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Предыдущее объявление" }));
    expect(await screen.findByAltText("Заголовок")).toBeInTheDocument();
    expect(asked.filter((entry) => entry === "creatives:a1")).toHaveLength(1);
    expect(asked.filter((entry) => entry === "creatives:a2")).toHaveLength(1);
  });

  it("shows a loader while the selected creative is fetched", async () => {
    api();
    server.use(mock.get("/api/ads/:id/creatives", async () => {
      await delay(60);
      return HttpResponse.json([creative()]);
    }));
    renderWithProviders(<CreativePreviewDialog ads={[ad()]} initialAdId="a1" onClose={() => {}} />);

    expect(await screen.findByRole("status")).toHaveTextContent("Загрузка…");
    expect(await screen.findByAltText("Заголовок")).toBeInTheDocument();
  });

  it("plays a stored video creative", async () => {
    api({ a1: [creative({ kind: "VIDEO", hasFile: true, hasPoster: true })] });
    renderWithProviders(<CreativePreviewDialog ads={[ad()]} initialAdId="a1" onClose={() => {}} />);

    await waitFor(() => expect(document.querySelector("video")).toBeInTheDocument());
    expect(document.querySelector("video")).toHaveAttribute("src", expect.stringContaining("blob:"));
  });

  it("shows an uncopied video through the provider's player", async () => {
    api({ a1: [creative({ kind: "VIDEO", hasFile: false, hasPoster: true })] });
    server.use(mock.get("/api/ads/:id/preview", () =>
      HttpResponse.json({ url: "https://business.facebook.com/ads/api/preview_iframe.php?d=AQ" })));
    renderWithProviders(<CreativePreviewDialog ads={[ad()]} initialAdId="a1" onClose={() => {}} />);

    expect(await screen.findByTitle("Первое")).toHaveAttribute(
      "src", "https://business.facebook.com/ads/api/preview_iframe.php?d=AQ",
    );
  });

  it("keeps the poster and provider link when Meta renders nothing", async () => {
    const asked = api({ a1: [creative({ kind: "VIDEO", hasFile: false, hasPoster: true })] });
    server.use(mock.get("/api/ads/:id/preview", () =>
      HttpResponse.json({ error: { message: "no" } }, { status: 404 })));
    renderWithProviders(<CreativePreviewDialog ads={[ad()]} initialAdId="a1" onClose={() => {}} />);

    expect(await screen.findByRole("link", { name: "Смотреть в Ads Manager" })).toBeInTheDocument();
    await waitFor(() => expect(asked).toContain("poster:cr1"));
    expect(asked).not.toContain("file:cr1");
  });

  it("says in Russian when the selected ad has no creative", async () => {
    api({ a1: [] });
    renderWithProviders(<CreativePreviewDialog ads={[ad()]} initialAdId="a1" onClose={() => {}} />);

    expect(await screen.findByText("У объявления нет креатива")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    api();
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<CreativePreviewDialog ads={[ad()]} initialAdId="a1" onClose={onClose} />);

    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
