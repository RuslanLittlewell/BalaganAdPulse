import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { JoinClientForm } from "@/pages/registration/index.js";

function open() {
  return renderWithProviders(
    <Routes>
      <Route path="/regustration/:code" element={<JoinClientForm code="ABCDEFGH" />} />
      <Route path="/login" element={<h1>Вход</h1>} />
    </Routes>,
    { route: "/regustration/ABCDEFGH", signedIn: false },
  );
}

async function fill(u: ReturnType<typeof userEvent.setup>, password = "hunter2hunter2") {
  await u.type(screen.getByLabelText("Имя"), "Мария");
  await u.type(screen.getByLabelText("Email"), "maria@clinic.by");
  await u.type(screen.getByLabelText("Пароль"), password);
  await u.type(screen.getByLabelText("Повторите пароль"), password);
}

describe("JoinClientForm", () => {
  // The company already exists — this person is joining it, not creating one.
  it("asks about the person and nothing about a company", () => {
    open();

    for (const label of ["Имя", "Email", "Пароль", "Повторите пароль"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Название организации")).toBeNull();
    expect(screen.queryByLabelText("Название проекта")).toBeNull();
  });

  it("offers an avatar", () => {
    open();

    expect(screen.getByRole("button", { name: "Создать аватар" })).toBeInTheDocument();
  });

  it("registers with the code from the link, carrying no company", async () => {
    const u = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/auth/register", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 });
    }));
    open();

    await fill(u);
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      name: "Мария", email: "maria@clinic.by", inviteCode: "ABCDEFGH",
    });
    expect(body).not.toHaveProperty("client");
    expect(body).not.toHaveProperty("project");
  });

  it("refuses two passwords that differ", async () => {
    const u = userEvent.setup();
    open();

    await u.type(screen.getByLabelText("Имя"), "Мария");
    await u.type(screen.getByLabelText("Email"), "maria@clinic.by");
    await u.type(screen.getByLabelText("Пароль"), "hunter2hunter2");
    await u.type(screen.getByLabelText("Повторите пароль"), "другой");
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Пароли не совпадают")).toBeInTheDocument();
  });

  it("sends them to the sign-in form afterwards", async () => {
    const u = userEvent.setup();
    server.use(mock.post("/api/auth/register", () =>
      HttpResponse.json({ accessToken: "a", refreshToken: "r" }, { status: 201 })));
    open();

    await fill(u);
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  it("reports a refusal without losing what was typed", async () => {
    const u = userEvent.setup();
    server.use(mock.post("/api/auth/register", () =>
      HttpResponse.json({ error: { message: "Ссылка уже использована" } }, { status: 403 })));
    open();

    await fill(u);
    await u.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ссылка уже использована");
    expect(screen.getByLabelText("Имя")).toHaveValue("Мария");
  });
});
