import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { EmployeeRegistrationForm } from "@/pages/registration/index.js";

function open() {
  return renderWithProviders(
    <EmployeeRegistrationForm code="ABCDEFGH" />,
    { route: "/regustration/ABCDEFGH", signedIn: false },
  );
}

async function fill(user: ReturnType<typeof userEvent.setup>, password = "hunter2hunter2") {
  await user.type(screen.getByLabelText("Имя"), "Пётр");
  await user.type(screen.getByLabelText("Email"), "petr@acme.com");
  await user.type(screen.getByLabelText("Пароль"), password);
  await user.type(screen.getByLabelText("Повторите пароль"), password);
}

describe("EmployeeRegistrationForm", () => {
  it("asks for a name, an email, a password and its confirmation", () => {
    open();

    for (const label of ["Имя", "Email", "Пароль", "Повторите пароль"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("registers with the code from the link", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/auth/register", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 });
    }));
    open();

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(body).toMatchObject({
      name: "Пётр", email: "petr@acme.com", password: "hunter2hunter2",
      inviteCode: "ABCDEFGH",
    });
  });

  it("refuses two passwords that differ, and sends nothing", async () => {
    const user = userEvent.setup();
    let posted = false;
    server.use(mock.post("/api/auth/register", () => {
      posted = true;
      return HttpResponse.json({}, { status: 201 });
    }));
    open();

    await user.type(screen.getByLabelText("Имя"), "Пётр");
    await user.type(screen.getByLabelText("Email"), "petr@acme.com");
    await user.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await user.type(screen.getByLabelText("Повторите пароль"), "hunter2hunter3");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Пароли не совпадают")).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("refuses a password that is too short", async () => {
    const user = userEvent.setup();
    open();

    await fill(user, "short");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Минимум 8 символов")).toBeInTheDocument();
  });

  it("offers an avatar to draw or to upload", async () => {
    open();

    expect(screen.getByRole("button", { name: "Создать аватар" })).toBeInTheDocument();
    expect(screen.getByLabelText("Загрузить изображение")).toBeInTheDocument();
  });

  // The same editor the profile and the contact book open, so an avatar is made
  // the one way everywhere rather than being randomised here and drawn there.
  it("opens the avatar editor", async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole("button", { name: "Создать аватар" }));

    expect(await screen.findByRole("dialog", { name: "Редактор аватара" })).toBeInTheDocument();
  });

  /**
   * The picture is held until there is an account to save it against.
   *
   * Driven through the upload path rather than the editor: drawing one needs a
   * canvas and `Image.decode`, neither of which jsdom has, so a test that went
   * that way would be asserting the stub rather than the behaviour.
   */
  it("sends the avatar only after the account exists", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    server.use(
      mock.post("/api/auth/register", () => {
        calls.push("register");
        return HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 });
      }),
      mock.put("/api/user/avatar", () => {
        calls.push("avatar");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    open();

    await user.upload(
      screen.getByLabelText("Загрузить изображение"),
      new File([new Uint8Array([1])], "me.png", { type: "image/png" }),
    );
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    await waitFor(() => expect(calls).toEqual(["register", "avatar"]));
  });

  it("sends no avatar when the registration itself is refused", async () => {
    const user = userEvent.setup();
    let uploaded = false;
    server.use(
      mock.post("/api/auth/register", () =>
        HttpResponse.json({ error: { message: "Занято" } }, { status: 403 })),
      mock.put("/api/user/avatar", () => {
        uploaded = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    open();

    await user.upload(
      screen.getByLabelText("Загрузить изображение"),
      new File([new Uint8Array([1])], "me.png", { type: "image/png" }),
    );
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    await screen.findByRole("alert");
    expect(uploaded).toBe(false);
  });

  it("reports a refusal from the API without losing what was typed", async () => {
    const user = userEvent.setup();
    server.use(mock.post("/api/auth/register", () =>
      HttpResponse.json({ error: { message: "Ссылка уже использована" } }, { status: 403 })));
    open();

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ссылка уже использована");
    expect(screen.getByLabelText("Имя")).toHaveValue("Пётр");
  });
});

/**
 * Both fields are required, and they are compared — including after the first
 * one changes. Two empty boxes compare equal, so a confirmation that only
 * checked equality would let an account through with no password at all.
 */
describe("EmployeeRegistrationForm's password rules", () => {
  it("refuses an empty password", async () => {
    const u = userEvent.setup();
    open();

    await u.type(screen.getByLabelText("Имя"), "Пётр");
    await u.type(screen.getByLabelText("Email"), "petr@acme.com");
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Введите пароль")).toBeInTheDocument();
  });

  it("refuses an empty confirmation", async () => {
    const u = userEvent.setup();
    open();

    await u.type(screen.getByLabelText("Имя"), "Пётр");
    await u.type(screen.getByLabelText("Email"), "petr@acme.com");
    await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Повторите пароль ещё раз")).toBeInTheDocument();
  });

  it("refuses two empty boxes rather than calling them equal", async () => {
    const u = userEvent.setup();
    open();

    await u.type(screen.getByLabelText("Имя"), "Пётр");
    await u.type(screen.getByLabelText("Email"), "petr@acme.com");
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Введите пароль")).toBeInTheDocument();
    expect(screen.getByText("Повторите пароль ещё раз")).toBeInTheDocument();
  });

  // The comparison has to survive the first field changing after it was made.
  it("notices a password changed after the confirmation matched it", async () => {
    const u = userEvent.setup();
    let accepted = false;
    server.use(mock.post("/api/auth/register", () => {
      accepted = true;
      return HttpResponse.json({ error: { message: "Занято" } }, { status: 403 });
    }));
    open();

    await u.type(screen.getByLabelText("Имя"), "Пётр");
    await u.type(screen.getByLabelText("Email"), "petr@acme.com");
    await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Повторите пароль"), "hunter2hunter2");
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
    await waitFor(() => expect(accepted).toBe(true));

    await u.type(screen.getByLabelText("Пароль"), "3");
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Пароли не совпадают")).toBeInTheDocument();
  });
});

/**
 * How to reach somebody, asked once when they join. Optional: an account is not
 * worth refusing over a missing phone number.
 */
describe("a person's contact details at registration", () => {
  it("offers a phone and a telegram", () => {
    open();

    expect(screen.getByLabelText("Телефон")).toBeInTheDocument();
    expect(screen.getByLabelText("Телеграм")).toBeInTheDocument();
  });

  it("sends what was filled in", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/auth/register", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 });
    }));
    open();

    await fill(user);
    await user.type(screen.getByLabelText("Телефон"), "+375291112233");
    await user.type(screen.getByLabelText("Телеграм"), "@petr");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ phone: "+375291112233", telegram: "@petr" });
  });

  it("registers without them", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/auth/register", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 });
    }));
    open();

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ phone: null, telegram: null });
  });
});
