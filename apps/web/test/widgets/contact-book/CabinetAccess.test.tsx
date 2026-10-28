import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { aClient, renderWithProviders, server } from "@test/shared/index.js";
import { ContactBook } from "@/widgets/contact-book/ContactBook.js";

const acme = aClient({ id: "c1", name: "Acme" });

const issued = { login: "acme-4821@balagan.pro", password: "Secret234567", createdAt: "2026-10-28T10:00:00.000Z" };

function stubClipboard() {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: (text: string) => { written.push(text); return Promise.resolve(); } },
  });
  return written;
}

function serve(account: typeof issued | { login: string; password: null; createdAt: string } | null) {
  const asked = { created: 0, reissued: 0, read: 0 };
  let current = account;
  server.use(
    http.get("/api/clients", () => HttpResponse.json([acme])),
    http.get("/api/clients/c1/account", () => {
      asked.read += 1;
      return HttpResponse.json(current);
    }),
    http.post("/api/clients/c1/account", () => {
      asked.created += 1;
      current = issued;
      return HttpResponse.json(issued, { status: 201 });
    }),
    http.post("/api/clients/c1/account/password", () => {
      asked.reissued += 1;
      current = { ...issued, password: "Fresh2345678" };
      return HttpResponse.json(current);
    }),
  );
  return asked;
}

async function section() {
  renderWithProviders(<ContactBook open onClose={() => {}} />);
  return screen.findByRole("region", { name: "Доступ в кабинет" });
}

function signedInAs(role: "MANAGER" | "ADMIN") {
  server.use(http.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "u1", name: "Пётр", email: "petr@acme.by", login: null, image: null },
    platformAdmin: false,
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse", status: "ACTIVE" },
    role,
    clientIds: [],
    modules: ["DASHBOARD", "PROJECTS"],
  })));
}

describe("a client's cabinet access on the card", () => {
  it("offers an admin to create access and then shows the login with the password hidden", async () => {
    const user = userEvent.setup();
    const asked = serve(null);
    const access = await section();

    expect(await within(access).findByText("У клиента пока нет доступа в кабинет.")).toBeInTheDocument();
    await user.click(within(access).getByRole("button", { name: "Создать доступ" }));

    expect(await within(access).findByText("acme-4821@balagan.pro")).toBeInTheDocument();
    expect(within(access).queryByText("Secret234567")).toBeNull();
    expect(within(access).getByRole("button", { name: "Показать пароль" })).toHaveAttribute("aria-pressed", "false");
    expect(asked.created).toBe(1);
  });

  it("reveals the password on request and copies either value", async () => {
    const user = userEvent.setup();
    const written = stubClipboard();
    serve(issued);
    const access = await section();

    await user.click(await within(access).findByRole("button", { name: "Показать пароль" }));
    expect(within(access).getByText("Secret234567")).toBeInTheDocument();
    expect(within(access).getByRole("button", { name: "Скрыть пароль" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(access).getByRole("button", { name: "Скопировать пароль" }));
    await user.click(within(access).getByRole("button", { name: "Скопировать логин" }));
    expect(written).toEqual(["Secret234567", "acme-4821@balagan.pro"]);
  });

  it("issues a new password once the admin confirms", async () => {
    const user = userEvent.setup();
    const asked = serve(issued);
    const access = await section();

    await user.click(await within(access).findByRole("button", { name: "Новый пароль" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Выдать новый пароль?" });
    expect(confirm).toHaveTextContent("Старый пароль перестанет работать");
    await user.click(within(confirm).getByRole("button", { name: "Выдать пароль" }));

    await waitFor(() => expect(asked.reissued).toBe(1));
    await user.click(within(access).getByRole("button", { name: "Показать пароль" }));
    expect(await within(access).findByText("Fresh2345678")).toBeInTheDocument();
  });

  it("changes nothing when the admin cancels the new password", async () => {
    const user = userEvent.setup();
    const asked = serve(issued);
    const access = await section();

    await user.click(await within(access).findByRole("button", { name: "Новый пароль" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Отмена" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(asked.reissued).toBe(0);
  });

  it("says the client changed the password and still offers a new one", async () => {
    serve({ login: "acme-4821@balagan.pro", password: null, createdAt: issued.createdAt });
    const access = await section();

    expect(await within(access).findByText("Клиент сменил пароль")).toBeInTheDocument();
    expect(within(access).queryByRole("button", { name: "Показать пароль" })).toBeNull();
    expect(within(access).getByRole("button", { name: "Новый пароль" })).toBeInTheDocument();
  });

  it("raises an alert when access cannot be created", async () => {
    const user = userEvent.setup();
    serve(null);
    server.use(http.post("/api/clients/c1/account", () =>
      HttpResponse.json({ error: { message: "Cabinet credentials are not available" } }, { status: 503 })));
    const access = await section();

    await user.click(await within(access).findByRole("button", { name: "Создать доступ" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось создать доступ");
  });

  it("shows a manager no such section and asks nothing", async () => {
    const asked = serve(issued);
    signedInAs("MANAGER");
    renderWithProviders(<ContactBook open onClose={() => {}} />);

    expect(await screen.findByRole("heading", { name: "Acme" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Доступ в кабинет" })).toBeNull();
    expect(asked.read).toBe(0);
  });
});
