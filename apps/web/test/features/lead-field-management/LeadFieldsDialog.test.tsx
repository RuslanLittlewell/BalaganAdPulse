import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { aLead } from "@test/shared/fixtures.js";
import { LeadFieldsDialog } from "@/features/lead-field-management/index.js";
import type { LeadField } from "@/entities/lead/index.js";

const capabilities = { create: true, update: true, delete: true };
const readOnly = { create: false, update: false, delete: false };
const BOARD = "/api/crm/boards/project-1";

const BUDGET: LeadField = { id: "budget", name: "Бюджет", type: "NUMBER", options: [], position: 0 };
const SEGMENT: LeadField = {
  id: "segment", name: "Сегмент", type: "SELECT", position: 1,
  options: [{ id: "o1", name: "Опт", color: "blue" }, { id: "o2", name: "Розница", color: "green" }],
};

function board(fields: LeadField[] = [BUDGET, SEGMENT], leads = [aLead()]) {
  server.use(
    mock.get(`${BOARD}/fields`, () => HttpResponse.json(fields)),
    mock.get(`${BOARD}/leads`, () => HttpResponse.json(leads)),
  );
}

const setup = (caps = capabilities, onClose = () => {}) =>
  renderWithProviders(<LeadFieldsDialog boardKey="project-1" capabilities={caps} onClose={onClose} />, { route: "/crm" });

const listed = () =>
  within(screen.getByRole("list", { name: "Поля доски" })).getAllByRole("listitem").map((item) => item.getAttribute("data-field"));

const actionsOf = async (name: string) => {
  await userEvent.click(await screen.findByRole("button", { name: `Действия поля: ${name}` }));
};

describe("the Поля dialog", () => {
  it("lists the board's fields in order with their types and options", async () => {
    board();
    setup();

    await screen.findByRole("list", { name: "Поля доски" });
    expect(listed()).toEqual(["Бюджет", "Сегмент"]);
    const item = screen.getAllByRole("listitem").find((entry) => entry.getAttribute("data-field") === "Сегмент")!;
    expect(item).toHaveTextContent("Список");
    expect(within(item).getByText("Опт")).toHaveAttribute("data-color", "blue");
  });

  it("explains an empty board", async () => {
    board([]);
    setup();

    expect(await screen.findByText(/Своих полей пока нет/)).toBeInTheDocument();
  });

  it("adds a list field with colored options and returns to the list", async () => {
    board([]);
    let posted: unknown = null;
    server.use(mock.post(`${BOARD}/fields`, async ({ request }) => {
      posted = await request.json();
      return HttpResponse.json({ ...SEGMENT, id: "new" }, { status: 201 });
    }));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Добавить поле" }));
    await userEvent.type(screen.getByLabelText("Название"), "Сегмент");
    await userEvent.click(screen.getByLabelText("Тип"));
    await userEvent.click(await screen.findByRole("option", { name: "Список" }));
    await userEvent.type(screen.getByLabelText("Название варианта 1"), "Опт");
    await userEvent.click(screen.getByRole("button", { name: "Добавить вариант" }));
    await userEvent.type(screen.getByLabelText("Название варианта 2"), "Розница");
    await userEvent.click(screen.getByLabelText("Цвет варианта 2"));
    await userEvent.click(await screen.findByRole("option", { name: "Зелёный" }));
    await userEvent.click(screen.getByRole("button", { name: "Добавить" }));

    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toEqual({
      name: "Сегмент", type: "SELECT",
      options: [{ name: "Опт", color: "gray" }, { name: "Розница", color: "green" }],
    });
    expect(await screen.findByRole("button", { name: "Добавить поле" })).toBeInTheDocument();
  });

  it("keeps the form and explains a taken or built-in name without asking the API", async () => {
    board();
    const posted = vi.fn();
    server.use(mock.post(`${BOARD}/fields`, () => { posted(); return HttpResponse.json({}, { status: 201 }); }));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Добавить поле" }));
    await userEvent.type(screen.getByLabelText("Название"), "Организация");
    await userEvent.click(screen.getByRole("button", { name: "Добавить" }));

    expect(await screen.findByText("Такое название уже занято")).toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toHaveValue("Организация");

    await userEvent.clear(screen.getByLabelText("Название"));
    await userEvent.type(screen.getByLabelText("Название"), "бюджет");
    await userEvent.click(screen.getByRole("button", { name: "Добавить" }));
    expect(await screen.findByText("Такое название уже занято")).toBeInTheDocument();
    expect(posted).not.toHaveBeenCalled();
  });

  it("asks for at least one option on a list field", async () => {
    board([]);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Добавить поле" }));
    await userEvent.type(screen.getByLabelText("Название"), "Сегмент");
    await userEvent.click(screen.getByLabelText("Тип"));
    await userEvent.click(await screen.findByRole("option", { name: "Несколько из списка" }));
    await userEvent.click(screen.getByRole("button", { name: "Убрать вариант" }));
    await userEvent.click(screen.getByRole("button", { name: "Добавить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Добавьте хотя бы один вариант");
  });

  it("keeps the entered values when the API refuses them", async () => {
    board([]);
    server.use(mock.post(`${BOARD}/fields`, () => HttpResponse.json({ error: { message: "nope" } }, { status: 400 })));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Добавить поле" }));
    await userEvent.type(screen.getByLabelText("Название"), "Бюджет");
    await userEvent.click(screen.getByRole("button", { name: "Добавить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось сохранить поле");
    expect(screen.getByLabelText("Название")).toHaveValue("Бюджет");
  });

  it("renames a field and edits its options, keeping the identity of the old ones", async () => {
    board();
    let patched: unknown = null;
    server.use(mock.patch(`${BOARD}/fields/segment`, async ({ request }) => {
      patched = await request.json();
      return HttpResponse.json([BUDGET, SEGMENT]);
    }));
    setup();

    await actionsOf("Сегмент");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Изменить" }));
    expect(screen.getByLabelText("Тип")).toBeDisabled();
    await userEvent.clear(screen.getByLabelText("Название"));
    await userEvent.type(screen.getByLabelText("Название"), "Тип клиента");
    await userEvent.clear(screen.getByLabelText("Название варианта 1"));
    await userEvent.type(screen.getByLabelText("Название варианта 1"), "Small");
    await userEvent.click(screen.getAllByRole("button", { name: "Опустить вариант" })[0]!);
    await userEvent.click(screen.getByRole("button", { name: "Добавить вариант" }));
    await userEvent.type(screen.getByLabelText("Название варианта 3"), "VIP");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(patched).not.toBeNull());
    expect(patched).toEqual({
      name: "Тип клиента",
      options: [
        { id: "o2", name: "Розница", color: "green" },
        { id: "o1", name: "Small", color: "blue" },
        { name: "VIP", color: "orange" },
      ],
    });
  });

  it("moves a field down", async () => {
    board();
    let patched: unknown = null;
    server.use(mock.patch(`${BOARD}/fields/budget`, async ({ request }) => {
      patched = await request.json();
      return HttpResponse.json([SEGMENT, BUDGET]);
    }));
    setup();

    await actionsOf("Бюджет");
    expect(await screen.findByRole("menuitem", { name: "Выше" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(screen.getByRole("menuitem", { name: "Ниже" }));

    await waitFor(() => expect(patched).toEqual({ position: 1 }));
  });

  it("states how many leads hold a value before deleting a field", async () => {
    board([BUDGET, SEGMENT], [
      aLead({ id: "a", customValues: { budget: "1.0000" } }),
      aLead({ id: "b", customValues: { budget: "2.0000", segment: "o1" } }),
      aLead({ id: "c" }),
    ]);
    const deleted = vi.fn();
    server.use(mock.delete(`${BOARD}/fields/budget`, () => { deleted(); return new HttpResponse(null, { status: 204 }); }));
    setup();

    await actionsOf("Бюджет");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Удалить" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Лидов со значением в этом поле: 2. Эти значения будут удалены.");
    await userEvent.click(within(confirm).getByRole("button", { name: "Удалить поле" }));

    await waitFor(() => expect(deleted).toHaveBeenCalled());
  });

  it("deletes nothing when the member cancels", async () => {
    board();
    const deleted = vi.fn();
    server.use(mock.delete(`${BOARD}/fields/budget`, () => { deleted(); return new HttpResponse(null, { status: 204 }); }));
    setup();

    await actionsOf("Бюджет");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Удалить" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Ни у одного лида нет значения в этом поле.");
    await userEvent.click(within(confirm).getByRole("button", { name: "Отмена" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(deleted).not.toHaveBeenCalled();
  });

  it("offers no add button once the board holds 30 fields", async () => {
    board(Array.from({ length: 30 }, (_, index) => ({ id: `f${index}`, name: `Поле ${index}`, type: "TEXT" as const, options: [], position: index })));
    setup();

    expect(await screen.findByText("На доске может быть не больше 30 полей")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить поле" })).not.toBeInTheDocument();
  });

  it("offers no changes to a member who may not change fields", async () => {
    board();
    setup(readOnly);

    await screen.findByRole("list", { name: "Поля доски" });
    expect(screen.queryByRole("button", { name: /Действия поля/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить поле" })).not.toBeInTheDocument();
  });
});
