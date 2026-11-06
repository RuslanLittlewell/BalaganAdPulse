import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { ApiError, http } from "@/shared/lib/index.js";
import { MainNav } from "@/widgets/main-nav/MainNav.js";
import { PlatformNav } from "@/widgets/platform-nav/index.js";

const png = (name = "shot.png") => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: "image/png" });

interface Sent {
  topic: FormDataEntryValue | null;
  message: FormDataEntryValue | null;
  page: FormDataEntryValue | null;
  userAgent: FormDataEntryValue | null;
  screen: FormDataEntryValue | null;
  screenshots: string[];
}

function captureFeedback(outcome: () => Promise<void> = async () => {}) {
  const sent: Sent[] = [];
  vi.spyOn(http, "postForm").mockImplementation(async (path: string, form: FormData) => {
    expect(path).toBe("/support/feedback");
    sent.push({
      topic: form.get("topic"),
      message: form.get("message"),
      page: form.get("page"),
      userAgent: form.get("userAgent"),
      screen: form.get("screen"),
      screenshots: form.getAll("screenshots").map((file) => (file as File).name),
    });
    await outcome();
    return undefined as never;
  });
  return sent;
}

afterEach(() => { vi.restoreAllMocks(); });

function contacts(body: { email: string | null; feedback: boolean }) {
  server.use(mock.get("/api/support/contacts", () => HttpResponse.json(body)));
}

async function openHelp(route = "/projects/42?tab=leads") {
  renderWithProviders(
    <Routes>
      <Route path="*" element={<MainNav />} />
    </Routes>,
    { route },
  );
  await userEvent.click(await screen.findByRole("button", { name: "Помощь" }));
  return screen.findByRole("dialog", { name: "Помощь и обратная связь" });
}

function paste(target: Element, files: File[]) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { files, getData: () => "", types: ["Files"] } });
  target.dispatchEvent(event);
}

const fileInput = (dialog: HTMLElement) => dialog.querySelector('input[type="file"]') as HTMLInputElement;

describe("the help item", () => {
  it("opens the help and feedback dialog from the bottom of the menu", async () => {
    const dialog = await openHelp();
    expect(dialog).toBeInTheDocument();
  });

  it("is not in the platform administrator's menu", async () => {
    renderWithProviders(<PlatformNav />);
    expect(await screen.findByRole("link", { name: "Организации" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Помощь" })).not.toBeInTheDocument();
  });
});

describe("the feedback form", () => {
  it("starts on reporting a problem and lists the six topics in order", async () => {
    const user = userEvent.setup();
    await openHelp();

    const topic = screen.getByRole("combobox", { name: "Тема" });
    expect(topic).toHaveTextContent("Сообщить о проблеме");
    await user.click(topic);
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Сообщить о проблеме", "Предложить улучшение", "Вопрос по работе сервиса",
      "Тариф и оплата", "Подключение рекламных кабинетов", "Другое",
    ]);
  });

  it("asks for a message before sending anything", async () => {
    const sent = captureFeedback();
    await openHelp();

    await userEvent.type(screen.getByLabelText("Сообщение"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(screen.getByLabelText("Сообщение")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Напишите сообщение")).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("sends the topic, the trimmed message, the context and the screenshots, then thanks the person", async () => {
    const user = userEvent.setup();
    const sent = captureFeedback();
    const dialog = await openHelp();

    await user.click(screen.getByRole("combobox", { name: "Тема" }));
    await user.click(await screen.findByRole("option", { name: "Предложить улучшение" }));
    await user.type(screen.getByLabelText("Сообщение"), "  Добавьте экспорт в Excel  ");
    await user.upload(fileInput(dialog), png("picked.png"));
    paste(dialog, [png("pasted.png")]);
    await waitFor(() => expect(screen.getAllByRole("img", { name: /Скриншоты: \d/ })).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: "Отправить" }));

    expect(await screen.findByText("Спасибо, сообщение отправлено.")).toBeInTheDocument();
    expect(screen.getByText("Ответим на buyer@acme.com.")).toBeInTheDocument();
    expect(sent).toEqual([{
      topic: "IMPROVEMENT",
      message: "Добавьте экспорт в Excel",
      page: "/projects/42?tab=leads",
      userAgent: navigator.userAgent,
      screen: `${window.screen.width}x${window.screen.height}`,
      screenshots: ["picked.png", "pasted.png"],
    }]);
  });

  it("closes from the thank-you", async () => {
    captureFeedback();
    await openHelp();

    await userEvent.type(screen.getByLabelText("Сообщение"), "Всё работает");
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));
    await userEvent.click(await screen.findByRole("button", { name: "Готово" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows neither the support email nor the hints button beside the form", async () => {
    await openHelp();

    expect(screen.queryByRole("link", { name: "balagan.ads@gmail.com" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Показать подсказки снова" })).not.toBeInTheDocument();
    expect(screen.queryByText(/адрес страницы, браузер/)).not.toBeInTheDocument();
  });

  it("removes an attached screenshot", async () => {
    const dialog = await openHelp();

    paste(dialog, [png()]);
    await userEvent.click(await screen.findByRole("button", { name: "Убрать скриншот 1" }));

    expect(screen.queryByRole("img", { name: /Скриншоты/ })).not.toBeInTheDocument();
  });

  it("takes no fourth screenshot", async () => {
    const dialog = await openHelp();

    paste(dialog, [png("1.png"), png("2.png"), png("3.png"), png("4.png")]);

    await waitFor(() => expect(screen.getAllByRole("img", { name: /Скриншоты: \d/ })).toHaveLength(3));
    expect(screen.getByRole("alert")).toHaveTextContent("Можно приложить не больше 3 скриншотов");
    expect(screen.getByRole("button", { name: "Добавить скриншот" })).toHaveAttribute("aria-disabled", "true");
  });

  it("refuses a file that is not a PNG, JPEG or WebP image", async () => {
    const dialog = await openHelp();

    paste(dialog, [new File(["gif"], "anim.gif", { type: "image/gif" })]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Подходят только изображения PNG, JPEG или WebP");
    expect(screen.queryByRole("img", { name: /Скриншоты/ })).not.toBeInTheDocument();
  });

  it("keeps the message and points to the email when sending fails", async () => {
    captureFeedback(async () => { throw new ApiError("Feedback cannot be sent right now", 503); });
    await openHelp();

    await userEvent.type(screen.getByLabelText("Сообщение"), "Не грузится отчёт");
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не удалось отправить сообщение");
    expect(within(alert).getByRole("link", { name: "balagan.ads@gmail.com" }))
      .toHaveAttribute("href", "mailto:balagan.ads@gmail.com");
    expect(screen.getByLabelText("Сообщение")).toHaveValue("Не грузится отчёт");
  });

  it("asks to wait after too many messages", async () => {
    captureFeedback(async () => { throw new ApiError("Too many requests, try again later", 429); });
    await openHelp();

    await userEvent.type(screen.getByLabelText("Сообщение"), "Ещё раз");
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Слишком много сообщений подряд");
  });
});

describe("when feedback cannot be sent", () => {
  it("replaces the form with the support email", async () => {
    contacts({ email: "balagan.ads@gmail.com", feedback: false });
    await openHelp();

    const notice = await screen.findByText(/Форма обратной связи сейчас недоступна/);
    expect(within(notice).getByRole("link", { name: "balagan.ads@gmail.com" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отправить" })).not.toBeInTheDocument();
  });

  it("says that support cannot be reached when no email is set", async () => {
    contacts({ email: null, feedback: false });
    await openHelp();

    expect(await screen.findByText("Написать в поддержку сейчас нельзя.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  });
});
