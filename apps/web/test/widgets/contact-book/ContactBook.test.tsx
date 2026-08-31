import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { aClient, renderWithProviders, server } from "@test/shared/index.js";
import { ContactBook } from "@/widgets/contact-book/ContactBook.js";

const acme = aClient({
  fullName: "Иван Петров",
  organization: "ООО «Акме»",
  unp: "191234567",
  phone: "+375 29 123-45-67",
  telegram: "@acme",
  email: "ivan@acme.by",
  website: "acme.by",
});

const bare = aClient({ id: "2", name: "Борода" });

function withClients(clients: unknown[]) {
  server.use(http.get("/api/clients", () => HttpResponse.json(clients)));
}

async function open(clients: unknown[] = [acme, bare]) {
  withClients(clients);
  renderWithProviders(<ContactBook open onClose={() => {}} />);
  return screen.findByRole("dialog", { name: "Контактная книга" });
}

describe("ContactBook", () => {
  it("lists every client", async () => {
    await open();
    expect(await screen.findByRole("button", { name: /Acme/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Борода/ })).toBeInTheDocument();
  });

  it("shows the first client's details without a click", async () => {
    const dialog = await open();
    expect(await within(dialog).findByText("Иван Петров")).toBeInTheDocument();
    expect(within(dialog).getByText("191234567")).toBeInTheDocument();
    expect(within(dialog).getByText("ООО «Акме»")).toBeInTheDocument();
  });

  it("names every contact field", async () => {
    const dialog = await open();
    for (const label of ["Полное имя", "Название организации", "УНП", "Телефон", "Телеграм", "Почта", "Сайт"]) {
      expect(await within(dialog).findByText(label), label).toBeInTheDocument();
    }
  });

  it("swaps the right pane when another client is chosen", async () => {
    const dialog = await open();
    expect(await within(dialog).findByText("Иван Петров")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Борода/ }));

    expect(within(dialog).queryByText("Иван Петров")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Борода" })).toBeInTheDocument();
  });

  it("makes the reachable details actionable", async () => {
    const dialog = await open([acme]);
    expect(await within(dialog).findByRole("link", { name: "ivan@acme.by" }))
      .toHaveAttribute("href", "mailto:ivan@acme.by");
    // A bare handle, a bare domain and a spaced phone number all become links.
    expect(within(dialog).getByRole("link", { name: "@acme" }))
      .toHaveAttribute("href", "https://t.me/acme");
    expect(within(dialog).getByRole("link", { name: "acme.by" }))
      .toHaveAttribute("href", "https://acme.by");
    expect(within(dialog).getByRole("link", { name: "+375 29 123-45-67" }))
      .toHaveAttribute("href", "tel:+375291234567");
  });

  it("shows a dash for a detail the client has not given", async () => {
    const dialog = await open([bare]);
    expect(await within(dialog).findByRole("heading", { name: "Борода" })).toBeInTheDocument();
    expect(within(dialog).getAllByText("—")).toHaveLength(7);
  });

  it("says so when there are no clients at all", async () => {
    await open([]);
    expect(await screen.findByText("Клиентов пока нет")).toBeInTheDocument();
  });
});

describe("ContactBook editing", () => {
  it("has no pencil or plus while a form is open", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));

    expect(screen.queryByRole("button", { name: "Редактировать контакт" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Новый контакт" })).not.toBeInTheDocument();
  });

  it("opens the pencil on the selected contact, prefilled", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));

    const form = screen.getByRole("form", { name: "Редактировать контакт" });
    expect(within(form).getByLabelText("Клиент")).toHaveValue("Acme");
    expect(within(form).getByLabelText("Полное имя")).toHaveValue("Иван Петров");
    expect(within(form).getByLabelText("УНП")).toHaveValue("191234567");
  });

  it("saves an edit and returns to the details", async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.patch("/api/clients/1", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...acme, ...sent });
      }),
    );
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));

    const phone = screen.getByLabelText("Телефон");
    await userEvent.clear(phone);
    await userEvent.type(phone, "+375 44 000-00-00");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("button", { name: "Редактировать контакт" })).toBeInTheDocument();
    expect(sent).toMatchObject({ phone: "+375 44 000-00-00", unp: "191234567" });
  });

  it("sends null for a field the user emptied, so the server clears it", async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.patch("/api/clients/1", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...acme, unp: null });
      }),
    );
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));
    await userEvent.clear(screen.getByLabelText("УНП"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await screen.findByRole("button", { name: "Редактировать контакт" });
    expect(sent?.unp).toBeNull();
  });

  it("opens an empty form on the plus", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Новый контакт" }));

    const form = screen.getByRole("form", { name: "Новый контакт" });
    expect(within(form).getByLabelText("Клиент")).toHaveValue("");
    expect(within(form).getByLabelText("Полное имя")).toHaveValue("");
    expect(within(form).getByRole("button", { name: "Создать" })).toBeInTheDocument();
  });

  it("creates a contact and shows it", async () => {
    await open();
    // Registered after open(), whose own handler would otherwise win: MSW
    // resolves with the most recently added match.
    server.use(
      http.post("/api/clients", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...bare, id: "3", ...body }, { status: 201 });
      }),
      http.get("/api/clients", () =>
        HttpResponse.json([acme, bare, { ...bare, id: "3", name: "Новый" }])),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Новый контакт" }));
    await userEvent.type(screen.getByLabelText("Клиент"), "Новый");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByRole("heading", { name: "Новый" })).toBeInTheDocument();
  });

  it("refuses to create a contact with no name", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Новый контакт" }));
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Введите имя")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Новый контакт" })).toBeInTheDocument();
  });

  it("drops an edit when another contact is chosen", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));
    await userEvent.type(screen.getByLabelText("Полное имя"), " лишнее");

    await userEvent.click(screen.getByRole("button", { name: /Борода/ }));

    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Борода" })).toBeInTheDocument();
  });

  it("returns to the details on cancel", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByText("Иван Петров")).toBeInTheDocument();
  });
});
