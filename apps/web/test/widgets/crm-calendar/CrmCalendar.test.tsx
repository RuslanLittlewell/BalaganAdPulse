import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aLead, renderWithProviders, server } from "@test/shared/index.js";
import { CrmCalendar } from "@/widgets/crm-calendar/index.js";
import type { Lead } from "@/entities/lead/index.js";

const TODAY = "2026-09-17";

function calendar(leads: Lead[] = [], props: Partial<React.ComponentProps<typeof CrmCalendar>> = {}) {
  server.use(mock.get("/api/crm/boards/project-1/leads", () => HttpResponse.json(leads)));
  return renderWithProviders(<CrmCalendar boardKey="project-1" today={TODAY} {...props} />, { route: "/crm" });
}

const DAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];

describe("the week the calendar shows", () => {
  it("opens on the week that holds today", async () => {
    calendar();
    expect(await screen.findByText("14 – 20 сентября 2026")).toBeInTheDocument();
  });

  it("draws seven days, Monday to Sunday", async () => {
    calendar();
    const columns = await screen.findAllByRole("group");
    expect(columns).toHaveLength(7);
    expect(columns.map((column) => column.getAttribute("aria-label")?.split(",")[0]))
      .toEqual(DAYS);
  });

  it("marks today", async () => {
    calendar();
    const columns = await screen.findAllByRole("group");
    expect(columns.filter((column) => column.dataset.today === "true")).toHaveLength(1);
    expect(columns[3]!.dataset.today).toBe("true");
  });

  it("goes to the next week and back to the previous one", async () => {
    calendar();
    await userEvent.click(await screen.findByRole("button", { name: "Следующая неделя" }));
    expect(await screen.findByText("21 – 27 сентября 2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Предыдущая неделя" }));
    expect(await screen.findByText("14 – 20 сентября 2026")).toBeInTheDocument();
  });

  it("comes back to the week that holds today", async () => {
    calendar();
    const forward = await screen.findByRole("button", { name: "Следующая неделя" });
    await userEvent.click(forward);
    await userEvent.click(forward);
    await userEvent.click(forward);
    await screen.findByText("5 – 11 октября 2026");

    await userEvent.click(screen.getByRole("button", { name: "Сегодня" }));
    expect(await screen.findByText("14 – 20 сентября 2026")).toBeInTheDocument();
  });
});

describe("what the calendar holds", () => {
  it("shows a hand-made lead on the day it was created", async () => {
    calendar([aLead({ id: "l1", name: "Анна", createdAt: "2026-09-16T09:00:00.000Z" })]);
    const wednesday = await screen.findByRole("group", { name: /среда/ });
    expect(await within(wednesday).findByText("Анна")).toBeInTheDocument();
  });

  it("shows an imported lead on the day it was submitted, not the day it was imported", async () => {
    calendar([aLead({
      id: "l1", name: "Мария", origin: "META", createdAt: "2026-09-17T08:00:00.000Z",
      metaSource: {
        accountId: "1", formId: "f1",
        campaign: { externalId: "c1", name: "Весна" }, adSet: { externalId: "s1", name: "Москва" }, ad: { externalId: "a1", name: "Видео" },
        submittedAt: "2026-09-16T20:00:00.000Z", answers: [], answersOmitted: false,
      },
    })]);
    const wednesday = await screen.findByRole("group", { name: /среда/ });
    expect(await within(wednesday).findByText("Мария")).toBeInTheDocument();
    const thursday = await screen.findByRole("group", { name: /четверг/ });
    expect(within(thursday).queryByText("Мария")).not.toBeInTheDocument();
  });

  it("holds no lead that arrived in another week", async () => {
    calendar([aLead({ name: "На той неделе", createdAt: "2026-09-25T00:00:00.000Z" })]);
    await screen.findByText("14 – 20 сентября 2026");
    expect(screen.queryByText("На той неделе")).not.toBeInTheDocument();
  });

  it("draws an empty day in its place", async () => {
    calendar([aLead({ createdAt: "2026-09-16T00:00:00.000Z" })]);
    const sunday = await screen.findByRole("group", { name: /воскресенье/ });
    expect(within(sunday).queryByRole("button", { name: /Открыть лид/ })).not.toBeInTheDocument();
  });

  it("orders leads within a day earliest-arrival-first", async () => {
    calendar([
      aLead({ id: "a", name: "Днём", createdAt: "2026-09-16T15:00:00.000Z" }),
      aLead({ id: "b", name: "Утром", createdAt: "2026-09-16T09:00:00.000Z" }),
    ]);

    const wednesday = await screen.findByRole("group", { name: /среда/ });
    await within(wednesday).findByText("Утром");
    const names = [...wednesday.querySelectorAll("article h3")].map((node) => node.textContent);
    expect(names).toEqual(["Утром", "Днём"]);
  });
});

describe("opening and dragging a card", () => {
  it("opens the same dialog a click on the board would, without offering to drag it", async () => {
    const onOpen = vi.fn();
    calendar([aLead({ id: "l1", name: "Анна", createdAt: "2026-09-16T09:00:00.000Z" })], { onOpen });

    const card = await screen.findByRole("button", { name: "Открыть лид: Анна" });
    expect(card).not.toHaveAttribute("data-draggable");
    expect(screen.queryByTestId("lead-drag-l1")).not.toBeInTheDocument();

    await userEvent.click(card);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "l1" })));
  });
});
