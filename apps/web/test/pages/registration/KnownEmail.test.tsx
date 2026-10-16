import type { ReactElement } from "react";
import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import {
  ClientRegistrationForm,
  EmployeeRegistrationForm,
  JoinClientForm,
  RegistrationPage,
} from "@/pages/registration/index.js";

const BOUND = "smoke@gmail.com";

function openAt(element: ReactElement) {
  return renderWithProviders(
    <Routes>
      <Route path="/regustration/:code" element={element} />
      <Route path="/login" element={<h1>Вход</h1>} />
    </Routes>,
    { route: "/regustration/ABCDEFGH", signedIn: false },
  );
}

function captureRegistration() {
  const bodies: Record<string, unknown>[] = [];
  server.use(mock.post("/api/auth/register", async ({ request }) => {
    bodies.push(await request.json() as Record<string, unknown>);
    return HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 });
  }));
  return bodies;
}

async function person(u: ReturnType<typeof userEvent.setup>) {
  await u.type(screen.getByLabelText("Имя"), "Пётр");
  await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
  await u.type(screen.getByLabelText("Повторите пароль"), "hunter2hunter2");
}

function expectBoundAddressShown() {
  const shown = screen.getByRole("group", { name: "Email" });
  expect(within(shown).getByText(BOUND)).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Email" })).not.toBeInTheDocument();
}

describe("a link bound to an address", () => {
  it.each([
    ["EMPLOYEE", "Регистрация сотрудника"],
    ["CLIENT", "Регистрация клиента"],
    ["CLIENT_STAFF", "Присоединиться к компании"],
  ] as const)("opens the %s form with the address filled in", async (registrationType, heading) => {
    server.use(mock.get("/api/regustration/:code", () =>
      HttpResponse.json({ registrationType, email: BOUND })));
    openAt(<RegistrationPage />);

    await screen.findByRole("heading", { name: heading });
    expectBoundAddressShown();
  });

  it("still asks for an email when the link names none", async () => {
    server.use(mock.get("/api/regustration/:code", () =>
      HttpResponse.json({ registrationType: "EMPLOYEE", email: null })));
    openAt(<RegistrationPage />);

    await screen.findByRole("heading", { name: "Регистрация сотрудника" });
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
    expect(screen.queryByText("Приглашение выдано на этот адрес, с ним вы будете входить.")).not.toBeInTheDocument();
  });

  it("registers an employee with the address from the link", async () => {
    const u = userEvent.setup();
    const bodies = captureRegistration();
    openAt(<EmployeeRegistrationForm code="ABCDEFGH" knownEmail={BOUND} />);

    expectBoundAddressShown();
    await person(u);
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ name: "Пётр", email: BOUND, inviteCode: "ABCDEFGH" });
  });

  it("registers a colleague of a client with the address from the link", async () => {
    const u = userEvent.setup();
    const bodies = captureRegistration();
    openAt(<JoinClientForm code="ABCDEFGH" knownEmail={BOUND} />);

    expectBoundAddressShown();
    await person(u);
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ email: BOUND, inviteCode: "ABCDEFGH" });
  });

  it("registers a client with the address on the account and on the company", async () => {
    const u = userEvent.setup();
    const bodies = captureRegistration();
    openAt(<ClientRegistrationForm code="ABCDEFGH" knownEmail={BOUND} />);

    expectBoundAddressShown();
    await person(u);
    await u.type(screen.getByLabelText("Название организации"), "ООО Клиника");
    await u.type(screen.getByLabelText("Телефон"), "+375291112233");
    await u.click(screen.getByRole("button", { name: "Далее" }));
    await u.type(await screen.findByLabelText("Название проекта"), "Стоматология");
    await u.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ email: BOUND, client: { email: BOUND } });
  });
});
