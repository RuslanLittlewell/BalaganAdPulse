import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { WebsiteLeadsDialog } from "@/features/website-leads/index.js";

const KEY_A = `bk_${"a".repeat(32)}`;
const KEY_B = `bk_${"b".repeat(32)}`;
const PATH = "/api/projects/p1/website-key";

function serveKey(initial: { key: string; allowedSites: string[] } | null) {
  let stored = initial && { ...initial, createdAt: "2026-11-12T10:00:00.000Z", rotatedAt: null };
  const sent: { method: string; path: string; body?: unknown }[] = [];
  server.use(
    mock.get(PATH, () => HttpResponse.json(stored)),
    mock.put(PATH, () => {
      sent.push({ method: "PUT", path: "key" });
      stored = stored ?? { key: KEY_A, allowedSites: [], createdAt: "2026-11-12T10:00:00.000Z", rotatedAt: null };
      return HttpResponse.json(stored, { status: 201 });
    }),
    mock.post(`${PATH}/rotate`, () => {
      sent.push({ method: "POST", path: "rotate" });
      stored = { ...stored!, key: KEY_B };
      return HttpResponse.json(stored);
    }),
    mock.put(`${PATH}/sites`, async ({ request }) => {
      const body = (await request.json()) as { sites: string[] };
      sent.push({ method: "PUT", path: "sites", body });
      stored = { ...stored!, allowedSites: body.sites };
      return HttpResponse.json(stored);
    }),
    mock.delete(PATH, () => {
      sent.push({ method: "DELETE", path: "key" });
      stored = null;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return sent;
}

const renderDialog = () => renderWithProviders(<WebsiteLeadsDialog projectId="p1" open onClose={() => {}} />);

describe("the website leads dialog", () => {
  it("creates the key when the project has none and shows the script tag", async () => {
    const user = userEvent.setup();
    const sent = serveKey(null);
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Создать ключ" }));

    expect(await screen.findByText(`<script async src="${window.location.origin}/api/intake/script.js" data-key="${KEY_A}"></script>`)).toBeInTheDocument();
    expect(sent).toEqual([{ method: "PUT", path: "key" }]);
  });

  it("explains the manual mode for custom forms with a call to copy", async () => {
    serveKey({ key: KEY_A, allowedSites: [] });
    renderDialog();

    expect(await screen.findByRole("heading", { name: "Свои формы" })).toBeInTheDocument();
    expect(screen.getByText(/balagan\.lead\(\{/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скопировать пример" })).toBeInTheDocument();
  });

  it("saves the allowed sites one per line", async () => {
    const user = userEvent.setup();
    const sent = serveKey({ key: KEY_A, allowedSites: ["old.example.com"] });
    renderDialog();

    const sites = await screen.findByRole("textbox", { name: "Разрешённые сайты" });
    expect(sites).toHaveValue("old.example.com");
    await user.clear(sites);
    await user.type(sites, "shop.example.com{enter}example.org");
    await user.click(screen.getByRole("button", { name: "Сохранить список" }));

    expect(sent).toEqual([{ method: "PUT", path: "sites", body: { sites: ["shop.example.com", "example.org"] } }]);
  });

  it("asks before replacing the key and then shows the new one", async () => {
    const user = userEvent.setup();
    const sent = serveKey({ key: KEY_A, allowedSites: [] });
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Заменить ключ" }));
    expect(sent).toEqual([]);
    const confirmation = screen.getByRole("group", { name: "Заменить ключ" });
    await user.click(within(confirmation).getByRole("button", { name: "Заменить" }));

    expect(await screen.findByText(`<script async src="${window.location.origin}/api/intake/script.js" data-key="${KEY_B}"></script>`)).toBeInTheDocument();
    expect(sent).toEqual([{ method: "POST", path: "rotate" }]);
  });

  it("removes the key after a confirmation and offers to create it again", async () => {
    const user = userEvent.setup();
    const sent = serveKey({ key: KEY_A, allowedSites: [] });
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Удалить ключ" }));
    await user.click(within(screen.getByRole("group", { name: "Удалить ключ" })).getByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("button", { name: "Создать ключ" })).toBeInTheDocument();
    expect(sent).toEqual([{ method: "DELETE", path: "key" }]);
  });

  it("reports a key that failed to load", async () => {
    server.use(mock.get(PATH, () => new HttpResponse(null, { status: 500 })));
    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить ключ");
  });
});
