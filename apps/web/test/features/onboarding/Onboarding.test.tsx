import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "@tanstack/react-query";
import type { Role } from "@adpulse/access-policy";
import { Route, Routes, useLocation } from "react-router-dom";
import { aSession, renderWithProviders, server } from "@test/shared/index.js";
import { OnboardingLayer, useFirstStepsDialog, type Onboarding } from "@/features/onboarding/index.js";
import { AppHeader } from "@/widgets/app-header/AppHeader.js";
import { MainNav } from "@/widgets/main-nav/MainNav.js";

const ADMIN_STEPS: Onboarding["steps"] = [
  { key: "client", done: true },
  { key: "project", done: true },
  { key: "adAccount", done: false },
  { key: "team", done: false },
  { key: "kpi", done: false },
  { key: "telegram", done: false },
];

function onboarding(state: Partial<Onboarding>) {
  const marks: string[] = [];
  let reads = 0;
  let current: Onboarding = { welcomed: true, hidden: false, steps: ADMIN_STEPS, firstProjectId: "p-1", ...state };
  server.use(
    mock.get("/api/onboarding", () => {
      reads += 1;
      return HttpResponse.json(current);
    }),
    mock.post("/api/onboarding/:mark", ({ params }) => {
      marks.push(String(params.mark));
      current = params.mark === "hide" ? { ...current, hidden: true } : { ...current, welcomed: true };
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { marks, reads: () => reads };
}

function signedInAs(role: Role) {
  server.use(mock.get("/api/auth/me", () => HttpResponse.json(aSession({ role }))));
}

function Where() {
  const location = useLocation();
  return <output aria-label="Адрес">{`${location.pathname}${location.search}`}</output>;
}

function AnyMutation() {
  const mutation = useMutation({ mutationFn: async () => undefined });
  return <button type="button" onClick={() => mutation.mutate()}>Сохранить что-то</button>;
}

function setup(route = "/") {
  return renderWithProviders(
    <Routes>
      <Route
        path="*"
        element={(
          <>
            <OnboardingLayer />
            <AppHeader />
            <MainNav />
            <Where />
            <AnyMutation />
          </>
        )}
      />
    </Routes>,
    { route },
  );
}

beforeEach(() => { useFirstStepsDialog.setState({ open: false }); });

describe("the welcome", () => {
  it("greets a new admin and leads to the first steps", async () => {
    const { marks } = onboarding({ welcomed: false });
    setup();

    const welcome = await screen.findByRole("dialog", { name: "Добро пожаловать в Balagan BI" });
    expect(welcome).toHaveTextContent("добавьте клиента, создайте проект и подключите рекламный кабинет");
    await userEvent.click(within(welcome).getByRole("button", { name: "Начать" }));

    expect(await screen.findByRole("dialog", { name: "Первые шаги" })).toBeInTheDocument();
    await waitFor(() => expect(marks).toEqual(["welcome"]));
  });

  it("greets an invited client with their own text and only closes", async () => {
    signedInAs("CLIENT");
    const { marks } = onboarding({ welcomed: false, steps: [] });
    setup();

    const welcome = await screen.findByRole("dialog", { name: "Добро пожаловать в Balagan BI" });
    expect(welcome).toHaveTextContent("показатели и отчёты по вашей рекламе");
    await userEvent.click(within(welcome).getByRole("button", { name: "Понятно" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(marks).toEqual(["welcome"]);
  });

  it("records the welcome when closed with Escape", async () => {
    signedInAs("GUEST");
    const { marks } = onboarding({ welcomed: false, steps: [] });
    setup();

    expect(await screen.findByRole("dialog", { name: "Добро пожаловать в Balagan BI" }))
      .toHaveTextContent("доступ к проектам, которыми с вами поделились");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(marks).toEqual(["welcome"]));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays away once the member has been welcomed", async () => {
    const { reads } = onboarding({ welcomed: true });
    setup();

    await waitFor(() => expect(reads()).toBeGreaterThan(0));
    expect(screen.queryByRole("dialog", { name: "Добро пожаловать в Balagan BI" })).not.toBeInTheDocument();
  });
});

describe("the first steps in the menu", () => {
  it("shows how many steps are done and lists them", async () => {
    onboarding({});
    setup();

    const item = await screen.findByRole("button", { name: /Первые шаги/ });
    expect(item).toHaveTextContent("2 из 6");
    await userEvent.click(item);

    const list = await screen.findByRole("dialog", { name: "Первые шаги" });
    expect(list).toHaveTextContent("Сделано 2 из 6");
    const steps = within(list).getAllByRole("listitem");
    expect(steps.map((step) => [step.getAttribute("data-step"), step.getAttribute("data-done")])).toEqual([
      ["client", "true"], ["project", "true"], ["adAccount", "false"],
      ["team", "false"], ["kpi", "false"], ["telegram", "false"],
    ]);
    expect(within(steps[0]!).queryByRole("button")).not.toBeInTheDocument();
    expect(within(steps[2]!).getByRole("button", { name: /Подключить рекламный кабинет/ })).toBeEnabled();
  });

  it("draws attention to the item while steps are left", async () => {
    onboarding({});
    setup();

    expect(await screen.findByRole("button", { name: /Первые шаги/ })).toHaveAttribute("data-attention", "true");
  });

  it("opens only the first step not done and locks the ones after it", async () => {
    onboarding({});
    setup();

    await userEvent.click(await screen.findByRole("button", { name: /Первые шаги/ }));
    const list = await screen.findByRole("dialog", { name: "Первые шаги" });

    expect(within(list).getByRole("button", { name: /Подключить рекламный кабинет/ })).toBeEnabled();
    for (const later of [/Пригласить сотрудника/, /Задать цель KPI/, /Подключить Telegram-бота/]) {
      const step = within(list).getByRole("button", { name: later });
      expect(step).toBeDisabled();
      expect(step).toHaveTextContent("Сначала выполните предыдущий шаг");
    }
  });

  it("shows a step done out of order as done, and still locks the undone ones after the first", async () => {
    onboarding({
      steps: [
        { key: "client", done: false },
        { key: "project", done: false },
        { key: "adAccount", done: false },
        { key: "team", done: true },
      ],
    });
    setup();

    await userEvent.click(await screen.findByRole("button", { name: /Первые шаги/ }));
    const list = await screen.findByRole("dialog", { name: "Первые шаги" });

    expect(within(list).getByRole("button", { name: /Добавить клиента/ })).toBeEnabled();
    expect(within(list).getByRole("button", { name: /Создать проект/ })).toBeDisabled();
    expect(list.querySelector('[data-step="team"]')).toHaveAttribute("data-done", "true");
  });

  it("keeps the item in the menu when the list is only closed", async () => {
    const { marks } = onboarding({});
    setup();

    await userEvent.click(await screen.findByRole("button", { name: /Первые шаги/ }));
    await screen.findByRole("dialog", { name: "Первые шаги" });
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Первые шаги" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Первые шаги/ })).toBeInTheDocument();
    expect(marks).toEqual([]);
  });

  it.each([
    ["hidden", { hidden: true }],
    ["all done", { steps: ADMIN_STEPS.map((step) => ({ ...step, done: true })) }],
    ["without steps", { steps: [] }],
  ])("is not in the menu when the list is %s", async (_label, state) => {
    const { reads } = onboarding(state);
    setup();

    await waitFor(() => expect(reads()).toBeGreaterThan(0));
    expect(await screen.findByRole("button", { name: "Помощь" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Первые шаги/ })).not.toBeInTheDocument();
  });

  it("leaves the menu for good once skipped", async () => {
    const { marks } = onboarding({});
    setup();

    await userEvent.click(await screen.findByRole("button", { name: /Первые шаги/ }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Первые шаги" })).getByRole("button", { name: "Пропустить" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /Первые шаги/ })).not.toBeInTheDocument());
    expect(marks).toEqual(["hide"]);
  });

  it("reads the steps again after any change the person makes", async () => {
    const { reads } = onboarding({});
    setup();
    await screen.findByRole("button", { name: /Первые шаги/ });
    const before = reads();

    await userEvent.click(screen.getByRole("button", { name: "Сохранить что-то" }));

    await waitFor(() => expect(reads()).toBeGreaterThan(before));
  });
});

describe("where a step leads", () => {
  async function choose(step: RegExp) {
    await userEvent.click(await screen.findByRole("button", { name: /Первые шаги/ }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Первые шаги" })).getByRole("button", { name: step }));
  }

  it("opens the first project to connect an ad account", async () => {
    onboarding({});
    setup("/reports");

    await choose(/Подключить рекламный кабинет/);

    expect(screen.getByRole("status", { name: "Адрес" })).toHaveTextContent("/projects/p-1");
    expect(screen.queryByRole("dialog", { name: "Первые шаги" })).not.toBeInTheDocument();
  });

  it("opens the project list when there is no project yet", async () => {
    onboarding({ firstProjectId: null, steps: [{ key: "adAccount", done: false }] });
    setup();

    await choose(/Подключить рекламный кабинет/);

    expect(screen.getByRole("status", { name: "Адрес" })).toHaveTextContent(/^\/projects$/);
  });

  it("opens the contact book on employees to invite one, and clears the link", async () => {
    onboarding({ steps: [{ key: "client", done: true }, { key: "team", done: false }] });
    setup("/projects");

    await choose(/Пригласить сотрудника/);

    const contacts = await screen.findByRole("dialog", { name: "Контактная книга" });
    expect(within(contacts).getByRole("radio", { name: "Сотрудники" })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(screen.getByRole("status", { name: "Адрес", hidden: true })).toHaveTextContent(/^\/projects$/));
  });

  it("opens the contact book on clients to add one", async () => {
    onboarding({ steps: [{ key: "client", done: false }] });
    setup();

    await choose(/Добавить клиента/);

    const contacts = await screen.findByRole("dialog", { name: "Контактная книга" });
    expect(within(contacts).getByRole("radio", { name: "Клиенты" })).toHaveAttribute("aria-checked", "true");
  });

  it("opens the profile settings for a manager", async () => {
    signedInAs("MANAGER");
    onboarding({ steps: [{ key: "profile", done: false }] });
    setup();

    await choose(/Заполнить профиль/);

    expect(await screen.findByRole("dialog", { name: "Настройки профиля" })).toBeInTheDocument();
  });

  it.each([
    [/Задать цель KPI/, "kpi", "/"],
    [/Подключить Telegram-бота/, "telegram", "/tasks"],
  ] as const)("takes %s to %s", async (step, key, path) => {
    onboarding({ steps: [{ key, done: false }] });
    setup("/projects");

    await choose(step);

    expect(screen.getByRole("status", { name: "Адрес" })).toHaveTextContent(new RegExp(`^${path}$`));
  });
});
