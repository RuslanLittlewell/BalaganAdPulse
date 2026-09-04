import { http as mock, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { RegistrationPage } from "@/pages/registration/index.js";

function open(code = "ABCDEFGH") {
  return renderWithProviders(
    <Routes><Route path="/regustration/:code" element={<RegistrationPage />} /></Routes>,
    { route: `/regustration/${code}`, signedIn: false },
  );
}

const resolves = (registrationType: "CLIENT" | "EMPLOYEE" | "CLIENT_STAFF") =>
  server.use(mock.get("/api/regustration/:code", () => HttpResponse.json({ registrationType })));

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

  // Unknown, revoked, used and expired are one answer: a stranger must not be
  // able to discover which codes exist by reading the difference.
  it("shows the joining form for an invitation to an existing client", async () => {
    resolves("CLIENT_STAFF");
    open();

    expect(await screen.findByRole("heading", { name: "Присоединиться к компании" }))
      .toBeInTheDocument();
  });

  it("shows one message for a code that cannot be used", async () => {
    server.use(mock.get("/api/regustration/:code", () =>
      HttpResponse.json({ error: { message: "Invalid invite code" } }, { status: 404 })));
    open("ZZZZZZZZ");

    expect(await screen.findByText("Ссылка недействительна")).toBeInTheDocument();
    expect(screen.queryByLabelText("Пароль")).not.toBeInTheDocument();
  });

  it("offers a way back to the sign-in form", async () => {
    server.use(mock.get("/api/regustration/:code", () =>
      HttpResponse.json({ error: { message: "Invalid invite code" } }, { status: 404 })));
    open("ZZZZZZZZ");

    expect(await screen.findByRole("link", { name: "Войти" })).toHaveAttribute("href", "/login");
  });

  it("asks the server about the code in the address", async () => {
    const seen: string[] = [];
    server.use(mock.get("/api/regustration/:code", ({ params }) => {
      seen.push(String(params.code));
      return HttpResponse.json({ registrationType: "EMPLOYEE" });
    }));
    open("QWERTYUI");

    await screen.findByRole("heading", { name: "Регистрация сотрудника" });
    expect(seen).toEqual(["QWERTYUI"]);
  });
});
