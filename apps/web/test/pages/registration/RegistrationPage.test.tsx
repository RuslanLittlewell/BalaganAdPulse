import { t } from "@/shared/config/index.js";
import { http as mock, HttpResponse } from "msw";
import { expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { RegistrationPage } from "@/pages/registration/index.js";

function open(code = "ABCDEFGH") {
  return renderWithProviders(
    <Routes><Route path="/registration/:code" element={<RegistrationPage />} /></Routes>,
    { route: `/registration/${code}`, signedIn: false },
  );
}

const resolves = (registrationType: "CLIENT" | "EMPLOYEE" | "CLIENT_STAFF" | "PARTNER") =>
  server.use(mock.get("/api/registration/:code", () => HttpResponse.json({ registrationType, email: null })));

describe("RegistrationPage", () => {
  it("shows the employee form for an employee invitation", async () => {
    resolves("EMPLOYEE");
    open();

    expect(await screen.findByRole("heading", { name: "Регистрация сотрудника" }))
      .toBeInTheDocument();
  });

  it("shows the client form for a client invitation", async () => {
    resolves("CLIENT");
    open();

    expect(await screen.findByRole("heading", { name: "Регистрация клиента" }))
      .toBeInTheDocument();
  });

  it("shows the joining form for an invitation to an existing client", async () => {
    resolves("CLIENT_STAFF");
    open();

    expect(await screen.findByRole("heading", { name: "Присоединиться к компании" }))
      .toBeInTheDocument();
  });

  it("shows one message for a code that cannot be used", async () => {
    server.use(mock.get("/api/registration/:code", () =>
      HttpResponse.json({ error: { message: "Invalid invite code" } }, { status: 404 })));
    open("ZZZZZZZZ");

    expect(await screen.findByText("Ссылка недействительна")).toBeInTheDocument();
    expect(screen.queryByLabelText("Пароль")).not.toBeInTheDocument();
  });

  it("offers a way back to the sign-in form", async () => {
    server.use(mock.get("/api/registration/:code", () =>
      HttpResponse.json({ error: { message: "Invalid invite code" } }, { status: 404 })));
    open("ZZZZZZZZ");

    expect(await screen.findByRole("link", { name: "Войти" })).toHaveAttribute("href", "/login");
  });

  it("asks the server about the code in the address", async () => {
    const seen: string[] = [];
    server.use(mock.get("/api/registration/:code", ({ params }) => {
      seen.push(String(params.code));
      return HttpResponse.json({ registrationType: "EMPLOYEE" });
    }));
    open("QWERTYUI");

    await screen.findByRole("heading", { name: "Регистрация сотрудника" });
    expect(seen).toEqual(["QWERTYUI"]);
  });
});


it("shows the joining form for a partner invitation", async () => {
  resolves("PARTNER");
  open();
  expect(await screen.findByRole("heading", {name: t("registration.partner.title")})).toBeInTheDocument();
  expect(screen.getByLabelText(t("auth.name.label"))).toBeInTheDocument();
});

it.each([null, 'dealer@example.com'])('creates a partner account through the registration link (bound email: %s)', async email => {
  const user = userEvent.setup();
  let sent: Record<string, unknown> | undefined;
  server.use(
    mock.get('/api/registration/:code', () => HttpResponse.json({registrationType:'PARTNER',email})),
    mock.post('/api/auth/register', async ({request}) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({accessToken:'access',refreshToken:'refresh'},{status:201});
    }),
  );
  renderWithProviders(<Routes>
    <Route path="/registration/:code" element={<RegistrationPage />} />
    <Route path="/login" element={<h1>Sign in</h1>} />
  </Routes>,{route:'/registration/ABCDEFGH',signedIn:false});
  await screen.findByRole('heading',{name:t('registration.partner.title')});
  await user.type(screen.getByLabelText(t('auth.name.label')),'Dealer');
  if (email === null) await user.type(screen.getByLabelText(t('auth.email.label')),'dealer@example.com');
  await user.type(screen.getByLabelText(t('auth.password.label')),'hunter2hunter2');
  await user.type(screen.getByLabelText(t('registration.password.confirm')),'hunter2hunter2');
  await user.click(screen.getByRole('button',{name:t('registration.submit')}));
  await screen.findByRole('heading',{name:'Sign in'});
  expect(sent).toMatchObject({name:'Dealer',email:'dealer@example.com',inviteCode:'ABCDEFGH',password:'hunter2hunter2'});
  expect(sent).not.toHaveProperty('client');
  expect(sent).not.toHaveProperty('project');
});
