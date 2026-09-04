import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { hasSession } from "@/shared/lib/index.js";
import { ClientRegistrationForm } from "@/pages/registration/index.js";

function open() {
  return renderWithProviders(
    <Routes>
      <Route path="/regustration/:code" element={<ClientRegistrationForm code="ABCDEFGH" />} />
      <Route path="/login" element={<h1>Вход</h1>} />
    </Routes>,
    { route: "/regustration/ABCDEFGH", signedIn: false },
  );
}

const user = () => userEvent.setup();

async function firstStep(u: ReturnType<typeof userEvent.setup>) {
  await u.type(screen.getByLabelText("Имя"), "Иван");
  await u.type(screen.getByLabelText("Email"), "ivan@clinic.by");
  await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
  await u.type(screen.getByLabelText("Повторите пароль"), "hunter2hunter2");
  await u.type(screen.getByLabelText("Название организации"), "ООО Клиника");
  await u.type(screen.getByLabelText("Телефон"), "+375291112233");
  await u.click(screen.getByRole("button", { name: "Далее" }));
}

describe("ClientRegistrationForm", () => {
  it("starts on the account step, with the contact's own fields", () => {
    open();

    for (const label of ["Имя", "Email", "Пароль", "Повторите пароль", "Название организации", "Телефон"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Название проекта")).toBeNull();
  });

  describe("the account step's two columns", () => {
    it("keeps who they are on the left", () => {
      open();
      const column = screen.getByTestId("registration-account-column");

      for (const label of ["Имя", "Email", "Пароль", "Повторите пароль"]) {
        expect(column).toContainElement(screen.getByLabelText(label));
      }
    });

    it("starts the second column at the organisation", () => {
      open();
      const column = screen.getByTestId("registration-contact-column");

      for (const label of ["Название организации", "Телефон", "Телеграм", "Сайт"]) {
        expect(column).toContainElement(screen.getByLabelText(label));
      }
      expect(column).not.toContainElement(screen.getByLabelText("Имя"));
    });

    it("draws the rule between them", () => {
      open();

      expect(screen.getByTestId("registration-contact-column").className)
        .toContain("border-l");
    });

    it("lays them side by side, not stacked", () => {
      open();
      const columns = screen.getByTestId("registration-account-columns");

      expect(columns.className).toContain("sm:grid-cols-2");
    });

    it("draws no dividing rule on the project step", async () => {
      const u = user();
      open();
      await firstStep(u);

      expect(screen.getByTestId("registration-account-columns"))
        .not.toContainElement(screen.getByLabelText("Название проекта"));
    });
  });

  it("offers an avatar on the first step", () => {
    open();

    expect(screen.getByRole("button", { name: "Создать аватар" })).toBeInTheDocument();
  });

  it("moves on to the project step", async () => {
    const u = user();
    open();

    await firstStep(u);

    expect(await screen.findByLabelText("Название проекта")).toBeInTheDocument();
    expect(screen.getByLabelText("Ниша")).toBeInTheDocument();
    expect(screen.getByLabelText("Бюджет / мес.")).toBeInTheDocument();
    expect(screen.getByLabelText("Валюта")).toBeInTheDocument();
  });

  it("starts the project on the agency's own currency", async () => {
    const u = user();
    open();

    await firstStep(u);

    expect(screen.getByLabelText("Валюта")).toHaveTextContent("BYN");
  });

  it("sends the budget with the currency it was stated in", async () => {
    const u = user();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/auth/register", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 });
    }));
    open();

    await firstStep(u);
    await u.type(screen.getByLabelText("Название проекта"), "Стоматология");
    await u.type(screen.getByLabelText("Бюджет / мес."), "5000");
    await u.click(screen.getByLabelText("Валюта"));
    await u.click(await screen.findByRole("option", { name: /USD/ }));
    await u.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      project: { name: "Стоматология", monthlyBudget: 5000, budgetCurrency: "USD" },
    });
  });

  it("puts the contact details on the account as well as on the company", async () => {
    const u = user();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/auth/register", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 });
    }));
    open();

    await firstStep(u);
    await u.type(screen.getByLabelText("Название проекта"), "Стоматология");
    await u.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      phone: "+375291112233",
      client: { phone: "+375291112233" },
    });
  });

  it("sends no amount when the budget is left empty", async () => {
    const u = user();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/auth/register", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 });
    }));
    open();

    await firstStep(u);
    await u.type(screen.getByLabelText("Название проекта"), "Стоматология");
    await u.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect((body as unknown as { project: { monthlyBudget: unknown } }).project.monthlyBudget)
      .toBeNull();
  });

  it("refuses to move on with no organisation", async () => {
    const u = user();
    open();

    await u.type(screen.getByLabelText("Имя"), "Иван");
    await u.type(screen.getByLabelText("Email"), "ivan@clinic.by");
    await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Повторите пароль"), "hunter2hunter2");
    await u.click(screen.getByRole("button", { name: "Далее" }));

    expect(await screen.findByText("Введите название организации")).toBeInTheDocument();
    expect(screen.queryByLabelText("Название проекта")).toBeNull();
  });

  it("refuses to move on with two passwords that differ", async () => {
    const u = user();
    open();

    await u.type(screen.getByLabelText("Имя"), "Иван");
    await u.type(screen.getByLabelText("Email"), "ivan@clinic.by");
    await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Повторите пароль"), "другой пароль");
    await u.click(screen.getByRole("button", { name: "Далее" }));

    expect(await screen.findByText("Пароли не совпадают")).toBeInTheDocument();
    expect(screen.queryByLabelText("Название проекта")).toBeNull();
  });

  it("keeps what was typed when going back a step", async () => {
    const u = user();
    open();
    await firstStep(u);

    await u.click(screen.getByRole("button", { name: "Назад" }));

    expect(screen.getByLabelText("Имя")).toHaveValue("Иван");
    expect(screen.getByLabelText("Название организации")).toHaveValue("ООО Клиника");
  });

  it("submits everything once, from the last step", async () => {
    const u = user();
    const bodies: Record<string, unknown>[] = [];
    server.use(mock.post("/api/auth/register", async ({ request }) => {
      bodies.push(await request.json() as Record<string, unknown>);
      return HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 });
    }));
    open();

    await firstStep(u);
    await u.type(screen.getByLabelText("Название проекта"), "Стоматология");
    await u.type(screen.getByLabelText("Ниша"), "Медицина");
    await u.click(screen.getByRole("button", { name: "Создать" }));

    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      name: "Иван", email: "ivan@clinic.by", inviteCode: "ABCDEFGH",
      client: { name: "Иван", organization: "ООО Клиника", phone: "+375291112233" },
      project: { name: "Стоматология", niche: "Медицина" },
    });
  });

  it("reports a refusal without losing either step", async () => {
    const u = user();
    server.use(mock.post("/api/auth/register", () =>
      HttpResponse.json({ error: { message: "Ссылка уже использована" } }, { status: 403 })));
    open();

    await firstStep(u);
    await u.type(screen.getByLabelText("Название проекта"), "Стоматология");
    await u.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ссылка уже использована");
    expect(screen.getByLabelText("Название проекта")).toHaveValue("Стоматология");

    await u.click(screen.getByRole("button", { name: "Назад" }));
    expect(screen.getByLabelText("Имя")).toHaveValue("Иван");
  });

  it("refuses a project with no name", async () => {
    const u = user();
    open();
    await firstStep(u);

    await u.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Введите название проекта")).toBeInTheDocument();
  });
});

describe("ClientRegistrationForm's password rules", () => {
  it("refuses an empty password", async () => {
    const u = userEvent.setup();
    open();

    await u.type(screen.getByLabelText("Имя"), "Пётр");
    await u.type(screen.getByLabelText("Email"), "petr@acme.com");
    await u.click(screen.getByRole("button", { name: "Далее" }));

    expect(await screen.findByText("Введите пароль")).toBeInTheDocument();
  });

  it("refuses an empty confirmation", async () => {
    const u = userEvent.setup();
    open();

    await u.type(screen.getByLabelText("Имя"), "Пётр");
    await u.type(screen.getByLabelText("Email"), "petr@acme.com");
    await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await u.click(screen.getByRole("button", { name: "Далее" }));

    expect(await screen.findByText("Повторите пароль ещё раз")).toBeInTheDocument();
  });

  it("refuses two empty boxes rather than calling them equal", async () => {
    const u = userEvent.setup();
    open();

    await u.type(screen.getByLabelText("Имя"), "Пётр");
    await u.type(screen.getByLabelText("Email"), "petr@acme.com");
    await u.click(screen.getByRole("button", { name: "Далее" }));

    expect(await screen.findByText("Введите пароль")).toBeInTheDocument();
    expect(screen.getByText("Повторите пароль ещё раз")).toBeInTheDocument();
  });

  it("notices a password changed after the confirmation matched it", async () => {
    const u = userEvent.setup();
    open();

    await u.type(screen.getByLabelText("Имя"), "Пётр");
    await u.type(screen.getByLabelText("Email"), "petr@acme.com");
    await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Повторите пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Название организации"), "ООО Клиника");
    await u.click(screen.getByRole("button", { name: "Далее" }));
    await waitFor(() => expect(screen.getByLabelText("Название проекта")).toBeVisible());
    await u.click(screen.getByRole("button", { name: "Назад" }));

    await u.type(screen.getByLabelText("Пароль"), "3");
    await u.click(screen.getByRole("button", { name: "Далее" }));

    expect(await screen.findByText("Пароли не совпадают")).toBeInTheDocument();
  });
});

describe("the avatar editor inside a step", () => {
  it("does not step forward when the avatar is saved", async () => {
    const u = user();
    open();
    await u.type(screen.getByLabelText("Имя"), "Иван");
    await u.type(screen.getByLabelText("Email"), "ivan@clinic.by");
    await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Повторите пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Название организации"), "ООО Клиника");

    await u.click(screen.getByRole("button", { name: "Создать аватар" }));
    await u.click(await screen.findByRole("button", { name: "Сохранить аватар" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Редактор аватара" })).toBeNull();
    });
    expect(screen.queryByLabelText("Название проекта")).toBeNull();
  });

  it("does not step forward when the editor's own random button is pressed", async () => {
    const u = user();
    open();

    await u.click(screen.getByRole("button", { name: "Создать аватар" }));
    await u.click(await screen.findByRole("button", { name: "Случайный вариант" }));

    expect(screen.queryByLabelText("Название проекта")).toBeNull();
  });
});

describe("finishing the client form", () => {
  const accepts = () => server.use(mock.post("/api/auth/register", () =>
    HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 })));

  it("sends them to the sign-in form", async () => {
    const u = user();
    accepts();
    open();

    await firstStep(u);
    await u.type(screen.getByLabelText("Название проекта"), "Стоматология");
    await u.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  it("leaves no session behind", async () => {
    const u = user();
    accepts();
    open();

    await firstStep(u);
    await u.type(screen.getByLabelText("Название проекта"), "Стоматология");
    await u.click(screen.getByRole("button", { name: "Создать" }));

    await screen.findByRole("heading", { name: "Вход" });
    expect(hasSession()).toBe(false);
  });

  it("refuses a jump forward past an unfilled step", async () => {
    const u = user();
    open();

    await u.click(screen.getByRole("button", { name: "Шаг 2" }));

    expect(await screen.findByText("Введите имя")).toBeInTheDocument();
    expect(screen.queryByLabelText("Название проекта")).toBeNull();
  });

  it("allows the jump once the step it skips is valid", async () => {
    const u = user();
    open();
    await u.type(screen.getByLabelText("Имя"), "Иван");
    await u.type(screen.getByLabelText("Email"), "ivan@clinic.by");
    await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Повторите пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Название организации"), "ООО Клиника");

    await u.click(screen.getByRole("button", { name: "Шаг 2" }));

    expect(await screen.findByLabelText("Название проекта")).toBeInTheDocument();
  });

  it("allows a jump backwards without asking", async () => {
    const u = user();
    open();
    await firstStep(u);

    await u.click(screen.getByRole("button", { name: "Шаг 1" }));

    expect(await screen.findByLabelText("Имя")).toHaveValue("Иван");
  });

  it("separates the footer with a horizontal rule", () => {
    open();

    const footer = screen.getByTestId("stepper-footer");
    expect(footer).toContainElement(screen.getByRole("button", { name: "Далее" }));
    expect(footer.className).toContain("border-t");
  });

  it("shows how many steps there are and which one this is", async () => {
    const u = user();
    open();

    expect(screen.getByRole("button", { name: "Шаг 1" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Шаг 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Далее" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Назад" })).toBeNull();

    await firstStep(u);

    expect(screen.getByRole("button", { name: "Создать" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Назад" })).toBeInTheDocument();
  });
});
