import { http as mock, HttpResponse } from "msw";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { MonthlyReport } from "@/widgets/monthly-report/index.js";

const ad = (adId: string, name: string, leads: number, spend: string, costPerLead: string | null) => ({ adId, name, leads, spend, costPerLead });

const staffReport = {
  id: "r8", projectId: "p1", month: "2026-08", status: "DRAFT", currency: "USD",
  spend: "3080.7700", leads: 95, costPerLead: "32.4292",
  previous: { month: "2026-07", spend: "3080.8500", leads: 69, costPerLead: "44.6500" },
  change: { leads: "0.3768", costPerLead: "-0.2737" },
  trend: [
    { month: "2026-07", spend: "3080.8500", leads: 69, costPerLead: "44.6500" },
    { month: "2026-08", spend: "3080.7700", leads: 95, costPerLead: "32.4292" },
  ],
  ads: [ad("a1", "Smart handle", 21, "738.5700", "35.1700"), ad("a2", "Tilt & turn", 17, "601.2900", "35.3700")],
  messengerContacts: 12,
  contactsSource: null as string | null,
  contacts: 12 as number | null,
  hasCover: false,
  conclusions: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Выросли на 38%" }] }] },
  plan: null,
  publishedAt: null, createdAt: "2026-09-01T09:00:00.000Z", updatedAt: "2026-09-01T09:00:00.000Z",
  computedAt: "2026-09-01T09:00:00.000Z", computedLeads: 95, leadsOverride: null,
  runningAds: [
    ad("a1", "Smart handle", 21, "738.5700", "35.1700"),
    ad("a2", "Tilt & turn", 17, "601.2900", "35.3700"),
    ad("a3", "Clean in 10 minutes", 15, "302.4000", "20.1600"),
  ],
  resultTotals: [{ type: "MESSAGES", results: 105 }, { type: "CALLS", results: 12 }] as { type: string; results: number }[] | null,
  history: [{ month: "2026-05", leads: 33, spend: null as string | null }],
};

const {
  computedAt: _c, computedLeads: _l, leadsOverride: _o, runningAds: _r, resultTotals: _t, history: _h, ...clientReport
} = { ...staffReport, status: "PUBLISHED" };

function App() {
  return (
    <Routes>
      <Route path="/reports/:reportId" element={<MonthlyReport reportId="r8" projectName={() => "Aurora"} currency={() => "USD"} />} />
      <Route path="/reports" element={<p>Список отчётов</p>} />
    </Routes>
  );
}

const route = { route: "/reports/r8" };

function serve(report: object) {
  const patches: unknown[] = [];
  let current = report;
  const now = () => current as typeof staffReport;
  server.use(
    mock.get("/api/ads/:adId/creatives", () => HttpResponse.json([])),
    mock.get("/api/reports/r8", () => HttpResponse.json(current)),
    mock.patch("/api/projects/p1/reports/r8", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push(body);
      const running = staffReport.runningAds;
      current = {
        ...current,
        ...body,
        ...("leadsOverride" in body ? {
          leads: body.leadsOverride ?? 95,
          costPerLead: body.leadsOverride === 90 ? "34.2308" : "32.4292",
        } : {}),
        ...("adIds" in body ? { ads: (body.adIds as string[]).map((id) => running.find((entry) => entry.adId === id)!) } : {}),
        ...("contactsSource" in body ? {
          contacts: body.contactsSource === null
            ? now().messengerContacts
            : now().resultTotals?.find((total) => total.type === body.contactsSource)?.results ?? 0,
        } : {}),
      };
      return HttpResponse.json(current);
    }),
    mock.put("/api/projects/p1/reports/r8/history", async ({ request }) => {
      const body = (await request.json()) as { months: { month: string; leads: number | null; spend: string | null }[] };
      patches.push({ history: body.months });
      current = {
        ...current,
        history: body.months.filter((entry) => entry.leads !== null).map((entry) => ({ month: entry.month, leads: entry.leads!, spend: entry.spend })),
      };
      return HttpResponse.json(current);
    }),
    mock.post("/api/projects/p1/reports/r8/publish", () => {
      current = { ...current, status: "PUBLISHED", publishedAt: "2026-09-02T09:00:00.000Z" };
      return HttpResponse.json(current);
    }),
    mock.delete("/api/projects/p1/reports/r8", () => new HttpResponse(null, { status: 204 })),
    mock.put("/api/projects/p1/reports/r8/cover", () => {
      current = { ...current, hasCover: true, updatedAt: "2026-09-03T09:00:00.000Z" };
      return HttpResponse.json(current);
    }),
    mock.delete("/api/projects/p1/reports/r8/cover", () => {
      current = { ...current, hasCover: false, updatedAt: "2026-09-04T09:00:00.000Z" };
      return HttpResponse.json(current);
    }),
    mock.get("/api/projects/p1/reports/r8/cover", () => new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } })),
  );
  return patches;
}

const card = (label: string) => screen.getByText(label, { selector: "div" }).parentElement!;

const adNames = () => within(screen.getByRole("region", { name: "Самые результативные креативы" }))
  .getAllByRole("listitem").map((item) => item.getAttribute("aria-label"));

describe("MonthlyReport", () => {
  it("shows a client the month's figures, trend, best ads and texts without any editing control", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-9", name: "Клиент", email: "client@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "CLIENT", clientIds: ["cl1"],
    })));
    serve(clientReport);
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("heading", { name: "Отчёт по рекламе · Август 2026" })).toBeInTheDocument();
    expect(card("Заявки")).toHaveTextContent("95+37,68% к прошлому месяцу");
    expect(card("Обращения в соцсети и мессенджеры")).toHaveTextContent("12");
    expect(within(screen.getByRole("list", { name: "Заявки по месяцам" })).getAllByRole("listitem")).toHaveLength(2);
    expect(adNames()).toEqual(["Smart handle", "Tilt & turn"]);
    expect(screen.getByText(/21 заявок по/)).toBeInTheDocument();
    expect(await screen.findByText("Выросли на 38%")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Обложка отчёта" })).not.toBeInTheDocument();

    for (const name of [/Исправить заявки/, /Изменить/, /Пересчитать/, /Опубликовать/, /Удалить отчёт/, /Выбрать креативы/, /Убрать/, /Заполнить прошлые месяцы/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("combobox", { name: "Что показывать в карточке" })).not.toBeInTheDocument();
  });

  it("shows a client the chosen result type under its name", async () => {
    serve({ ...clientReport, contactsSource: "MESSAGES", contacts: 105 });
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Сообщения", { selector: "div" })).toBeInTheDocument();
    expect(card("Сообщения")).toHaveTextContent("105");
    expect(screen.queryByText("Обращения в соцсети и мессенджеры")).not.toBeInTheDocument();
  });

  it("lets staff choose what the fourth card shows and go back to the count entered by hand", async () => {
    const patches = serve(staffReport);
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("combobox", { name: "Что показывать в карточке" }));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent))
      .toEqual(["Обращения вручную", "Сообщения · 105", "Звонки · 12"]);
    await userEvent.click(screen.getByRole("option", { name: "Сообщения · 105" }));

    expect(await screen.findByText("Сообщения", { selector: "div" })).toBeInTheDocument();
    expect(card("Сообщения")).toHaveTextContent("105");
    expect(screen.queryByRole("button", { name: "Изменить" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox", { name: "Что показывать в карточке" }));
    await userEvent.click(await screen.findByRole("option", { name: "Обращения вручную" }));
    expect(await screen.findByText("Обращения в соцсети и мессенджеры", { selector: "div" })).toBeInTheDocument();
    expect(card("Обращения в соцсети и мессенджеры")).toHaveTextContent("12");
    expect(patches).toEqual([{ contactsSource: "MESSAGES" }, { contactsSource: null }]);
  });

  it("asks staff to refresh a report stored before result types, offering the count entered by hand", async () => {
    serve({ ...staffReport, resultTotals: null });
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Пересчитайте отчёт, чтобы выбрать показатель из кабинета")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Что показывать в карточке" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Изменить" })).toBeInTheDocument();
  });

  it("lets staff enter the months before the report's month for the trend", async () => {
    const patches = serve(staffReport);
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("button", { name: "Заполнить прошлые месяцы" }));
    const form = screen.getByRole("form", { name: "Прошлые месяцы для графиков" });
    expect(within(form).getByRole("textbox", { name: "Заявки · Май 2026" })).toHaveValue("33");
    expect(within(form).getByRole("textbox", { name: "Заявки · Июль 2026" })).toHaveAttribute("placeholder", "69");

    await userEvent.type(within(form).getByRole("textbox", { name: "Заявки · Март 2026" }), "40");
    await userEvent.type(within(form).getByRole("textbox", { name: "Расход · Март 2026" }), "900,5");
    await userEvent.clear(within(form).getByRole("textbox", { name: "Заявки · Май 2026" }));
    await userEvent.click(within(form).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "Прошлые месяцы для графиков" })).not.toBeInTheDocument());
    expect(patches).toEqual([{ history: [
      { month: "2026-03", leads: 40, spend: "900.5" },
      { month: "2026-04", leads: null, spend: null },
      { month: "2026-05", leads: null, spend: null },
      { month: "2026-06", leads: null, spend: null },
      { month: "2026-07", leads: null, spend: null },
    ] }]);
  });

  it("does not send spend without leads or a malformed number", async () => {
    const patches = serve(staffReport);
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("button", { name: "Заполнить прошлые месяцы" }));
    const form = screen.getByRole("form", { name: "Прошлые месяцы для графиков" });
    await userEvent.type(within(form).getByRole("textbox", { name: "Расход · Апрель 2026" }), "100");

    expect(within(form).getByRole("alert")).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Сохранить" })).toBeDisabled();

    await userEvent.type(within(form).getByRole("textbox", { name: "Заявки · Апрель 2026" }), "1.5");
    expect(within(form).getByRole("button", { name: "Сохранить" })).toBeDisabled();
    expect(patches).toEqual([]);
  });

  it("lets staff correct the lead count and shows the Meta count beside it", async () => {
    const patches = serve(staffReport);
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("button", { name: "Исправить заявки" }));
    const field = screen.getByRole("textbox", { name: "Заявки" });
    await userEvent.clear(field);
    await userEvent.type(field, "-3");
    expect(screen.getByRole("alert")).toHaveTextContent("Введите целое число от 0");
    await userEvent.clear(field);
    await userEvent.type(field, "90");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("По данным Meta: 95")).toBeInTheDocument();
    expect(patches).toEqual([{ leadsOverride: 90 }]);
    expect(card("Заявки")).toHaveTextContent(/^Заявки90/);

    await userEvent.click(screen.getByRole("button", { name: "Вернуть данные Meta" }));
    await waitFor(() => expect(screen.queryByText("По данным Meta: 95")).not.toBeInTheDocument());
    expect(patches.at(-1)).toEqual({ leadsOverride: null });
  });

  it("lets staff add, reorder and remove the best ads", async () => {
    const patches = serve(staffReport);
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("button", { name: "Выбрать креативы" }));
    const dialog = await screen.findByRole("dialog", { name: "Выбрать креативы" });
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /Clean in 10 minutes/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(adNames()).toEqual(["Smart handle", "Tilt & turn", "Clean in 10 minutes"]));

    await userEvent.click(screen.getByRole("button", { name: "Выше: Clean in 10 minutes" }));
    await waitFor(() => expect(adNames()).toEqual(["Smart handle", "Clean in 10 minutes", "Tilt & turn"]));

    await userEvent.click(screen.getByRole("button", { name: "Убрать: Smart handle" }));
    await waitFor(() => expect(adNames()).toEqual(["Clean in 10 minutes", "Tilt & turn"]));

    expect(patches).toEqual([
      { adIds: ["a1", "a2", "a3"] },
      { adIds: ["a1", "a3", "a2"] },
      { adIds: ["a3", "a2"] },
    ]);
  });

  it("lets staff edit the conclusions in place", async () => {
    const patches = serve(staffReport);
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("button", { name: "Изменить: Выводы за месяц" }));
    expect(await screen.findByLabelText("Выводы за месяц", { selector: "[contenteditable]" })).toHaveAttribute("contenteditable", "true");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(patches).toEqual([{ conclusions: staffReport.conclusions }]));
    expect(await screen.findByText("Выросли на 38%")).toBeInTheDocument();
    expect(screen.queryByLabelText("Выводы за месяц", { selector: "[contenteditable]" })).not.toBeInTheDocument();
  });

  it("lets staff drop a cover onto the block, shows it, and removes it", async () => {
    URL.createObjectURL = vi.fn(() => "blob:cover");
    serve(staffReport);
    renderWithProviders(<App />, route);

    const block = await screen.findByRole("region", { name: "Обложка отчёта" });
    expect(within(block).queryByRole("img")).not.toBeInTheDocument();
    const file = new File(["x"], "cover.png", { type: "image/png" });
    fireEvent.drop(within(block).getByRole("button", { name: "Загрузить обложку" }), { dataTransfer: { files: [file], types: ["Files"] } });

    expect(await within(block).findByRole("img", { name: "Обложка отчёта" })).toHaveAttribute("src", "blob:cover");
    expect(within(block).getByRole("button", { name: "Заменить обложку" })).toBeInTheDocument();
    await userEvent.click(within(block).getByRole("button", { name: "Убрать обложку" }));
    await waitFor(() => expect(within(block).queryByRole("img")).not.toBeInTheDocument());
  });

  it("refuses a cover that is not a picture before sending it", async () => {
    serve(staffReport);
    renderWithProviders(<App />, route);

    const block = await screen.findByRole("region", { name: "Обложка отчёта" });
    fireEvent.drop(within(block).getByRole("button", { name: "Загрузить обложку" }), {
      dataTransfer: { files: [new File(["%PDF"], "cover.pdf", { type: "application/pdf" })], types: ["Files"] },
    });

    expect(await screen.findByText("Обложка — картинка JPEG, PNG или WebP до 10 МБ")).toBeInTheDocument();
  });

  it("shows a client the cover without controls, and no block when there is none", async () => {
    URL.createObjectURL = vi.fn(() => "blob:cover");
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-9", name: "Клиент", email: "client@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "CLIENT", clientIds: ["cl1"],
    })));
    serve({ ...clientReport, hasCover: true });
    renderWithProviders(<App />, route);

    const block = await screen.findByRole("region", { name: "Обложка отчёта" });
    expect(await within(block).findByRole("img", { name: "Обложка отчёта" })).toBeInTheDocument();
    expect(within(block).queryByRole("button")).not.toBeInTheDocument();
  });

  it("publishes a draft and offers to return it to draft", async () => {
    serve(staffReport);
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Черновик")).toBeInTheDocument();
    expect(screen.getByText("Клиент не видит черновик. Опубликуйте отчёт, чтобы он появился у клиента")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Опубликовать" }));

    expect(await screen.findByText("Опубликован")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Вернуть в черновик" })).toBeInTheDocument();
    expect(screen.queryByText(/Клиент не видит черновик/)).not.toBeInTheDocument();
  });

  it("deletes the report after confirmation and returns to the list", async () => {
    serve(staffReport);
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("button", { name: "Удалить отчёт" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Удалить" }));

    expect(await screen.findByText("Список отчётов")).toBeInTheDocument();
  });
});
