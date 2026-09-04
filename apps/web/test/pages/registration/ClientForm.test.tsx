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

/** The stepper owns the navigation, so its own footer button is what advances. */
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
    // Present but hidden: both steps stay mounted so going back loses nothing.
    // The stepper unmounts the step that is not on screen.
    expect(screen.queryByLabelText("Название проекта")).toBeNull();
  });

  /**
   * The account step is two columns split by a rule: who they are on the left,
   * the organisation they are from on the right. Asserted through the structure
   * that produces it, which is as close as jsdom gets to a layout.
   */
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

    // The rule belongs to the account step alone. The project step pairs the
    // budget with its currency on one row, which is not the same thing.
    it("draws no dividing rule on the project step", async () => {
      const u = user();
      open();
      await firstStep(u);

      /* Containment rather than absence: the stepper animates the outgoing step
         out, and jsdom never finishes the animation, so it lingers in the DOM. */
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

    /* Presence, not visibility: the stepper animates its steps in, and jsdom
       never runs the animation, so the content keeps its initial opacity. */
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

  // Nothing entered is no budget, not a zero the agency never agreed to.
  /**
   * At registration the person is the company's only contact, so the one answer
   * fills both records. They part ways afterwards: the person edits theirs in
   * their profile, the agency edits the company's on its card.
   */
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

  // The client record is created from these, and a contact with no organisation
  // named is not one the agency can act on.
  it("refuses to move on with no organisation", async () => {
    const u = user();
    open();

    await u.type(screen.getByLabelText("Имя"), "Иван");
    await u.type(screen.getByLabelText("Email"), "ivan@clinic.by");
    await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Повторите пароль"), "hunter2hunter2");
    await u.click(screen.getByRole("button", { name: "Далее" }));

    expect(await screen.findByText("Введите название организации")).toBeInTheDocument();
    // The stepper unmounts the step that is not on screen.
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
    // The stepper unmounts the step that is not on screen.
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

  // One request, at the end. The account, the client and the project are
  // created together or not at all.
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

/**
 * Both fields are required, and they are compared — including after the first
 * one changes. Two empty boxes compare equal, so a confirmation that only
 * checked equality would let an account through with no password at all.
 */
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

  // The comparison has to survive the first field changing after it was made.
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

/**
 * Radix renders the dialog through a portal, but React events travel the React
 * tree rather than the DOM one — so a submit inside the dialog reaches the form
 * the dialog was rendered inside, and saving an avatar stepped the visitor
 * forward as if they had pressed Далее.
 */
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

    // The stepper unmounts the step that is not on screen.
    expect(screen.queryByLabelText("Название проекта")).toBeNull();
  });

  it("does not step forward when the editor's own random button is pressed", async () => {
    const u = user();
    open();

    await u.click(screen.getByRole("button", { name: "Создать аватар" }));
    await u.click(await screen.findByRole("button", { name: "Случайный вариант" }));

    // The stepper unmounts the step that is not on screen.
    expect(screen.queryByLabelText("Название проекта")).toBeNull();
  });
});

describe("finishing the client form", () => {
  const accepts = () => server.use(mock.post("/api/auth/register", () =>
    HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 })));

  // The account is made; signing into it is the next thing they do.
  it("sends them to the sign-in form", async () => {
    const u = user();
    accepts();
    open();

    await firstStep(u);
    await u.type(screen.getByLabelText("Название проекта"), "Стоматология");
    await u.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  // Landing on a sign-in form while still signed in would be a lie about which
  // of the two states they are in.
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

  /**
   * The indicator is a way of moving too, and it used to move without asking —
   * so clicking the second circle skipped the first step's validation entirely
   * and carried an empty account into the project step.
   */
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

  // Going back is always allowed: nothing is being carried forward.
  it("allows a jump backwards without asking", async () => {
    const u = user();
    open();
    await firstStep(u);

    await u.click(screen.getByRole("button", { name: "Шаг 1" }));

    expect(await screen.findByLabelText("Имя")).toHaveValue("Иван");
  });

  // A rule between the fields and what acts on them, so the buttons read as the
  // end of the form rather than another field in it.
  it("separates the footer with a horizontal rule", () => {
    open();

    const footer = screen.getByTestId("stepper-footer");
    expect(footer).toContainElement(screen.getByRole("button", { name: "Далее" }));
    expect(footer.className).toContain("border-t");
  });

  // The stepper's indicator says which step this is, so nothing repeats it in
  // words: one circle per step, the current one marked.
  it("shows how many steps there are and which one this is", async () => {
    const u = user();
    open();

    expect(screen.getByRole("button", { name: "Шаг 1" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Шаг 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Далее" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Назад" })).toBeNull();

    await firstStep(u);

    // On the last step the forward button becomes the action itself.
    expect(screen.getByRole("button", { name: "Создать" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Назад" })).toBeInTheDocument();
  });
});
