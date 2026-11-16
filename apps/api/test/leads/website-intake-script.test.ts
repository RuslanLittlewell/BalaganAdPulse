import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { WEBSITE_INTAKE_SCRIPT } from "../../src/modules/leads/presentation/http/website-intake-script.js";

const KEY = `bk_${"a".repeat(32)}`;

function openPage(html: string, url = "https://shop.example.com/", mode: string | null = null) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url, runScripts: "outside-only", storageQuota: 1_000_000 });
  const { window } = dom;
  const fetch = vi.fn().mockResolvedValue({});
  Object.assign(window, { fetch });
  const script = { src: "https://api.example.com/api/intake/script.js", getAttribute: (name: string) => (name === "data-key" ? KEY : name === "data-mode" ? mode : null) };
  Object.defineProperty(window.document, "currentScript", { value: script, configurable: true });
  window.eval(WEBSITE_INTAKE_SCRIPT);
  const submit = (form: Element) => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const sent = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body as string) as Record<string, unknown>);
  return { dom, window, fetch, submit, sent };
}

const contactForm = `<form id="f">
  <label for="n">Ваше имя</label><input id="n" name="name" value="Анна">
  <input name="phone" type="tel" value="+375291234567">
  <input name="email" type="email" value="anna@example.com">
  <input name="message" placeholder="Комментарий" value="Нужен замер">
  <input name="password" type="password" value="secret">
</form>`;

describe("the website script", () => {
  it("sends a submitted contact form to the intake address with its fields and the page", async () => {
    const page = openPage(contactForm);

    page.submit(page.window.document.getElementById("f")!);

    expect(page.fetch).toHaveBeenCalledTimes(1);
    expect(page.fetch.mock.calls[0][0]).toBe("https://api.example.com/api/intake/leads");
    expect(page.sent()[0]).toMatchObject({
      key: KEY, name: "Анна", phone: "+375291234567", email: "anna@example.com",
      page_url: "https://shop.example.com/", fields: [{ question: "Комментарий", value: "Нужен замер" }],
    });
    expect(JSON.stringify(page.sent()[0])).not.toContain("secret");
  });

  it("stores the tags of the page address for later pages", async () => {
    const page = openPage("", "https://shop.example.com/?utm_source=facebook&utm_campaign=spring");

    expect(JSON.parse(page.window.localStorage.getItem("balagan_utm")!).tags).toEqual({ utm_source: "facebook", utm_campaign: "spring" });
  });

  it("sends the stored tags with the lead", async () => {
    const dom = new JSDOM(`<!doctype html><body>${contactForm}</body>`, { url: "https://shop.example.com/contacts", runScripts: "outside-only" });
    dom.window.localStorage.setItem("balagan_utm", JSON.stringify({ at: Date.now(), tags: { utm_campaign: "spring", utm_source: "facebook" } }));
    const fetch = vi.fn().mockResolvedValue({});
    Object.assign(dom.window, { fetch });
    Object.defineProperty(dom.window.document, "currentScript", {
      value: { src: "https://api.example.com/api/intake/script.js", getAttribute: (name: string) => (name === "data-key" ? KEY : null) },
      configurable: true,
    });
    dom.window.eval(WEBSITE_INTAKE_SCRIPT);

    dom.window.document.getElementById("f")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true }));

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ utm_campaign: "spring", utm_source: "facebook" });
  });

  it("forgets tags older than thirty days", async () => {
    const dom = new JSDOM(`<!doctype html><body>${contactForm}</body>`, { url: "https://shop.example.com/", runScripts: "outside-only" });
    dom.window.localStorage.setItem("balagan_utm", JSON.stringify({ at: Date.now() - 31 * 24 * 60 * 60 * 1000, tags: { utm_campaign: "old" } }));
    const fetch = vi.fn().mockResolvedValue({});
    Object.assign(dom.window, { fetch });
    Object.defineProperty(dom.window.document, "currentScript", {
      value: { src: "https://api.example.com/api/intake/script.js", getAttribute: (name: string) => (name === "data-key" ? KEY : null) },
      configurable: true,
    });
    dom.window.eval(WEBSITE_INTAKE_SCRIPT);

    dom.window.document.getElementById("f")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true }));

    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty("utm_campaign");
  });

  it("names a field by its label without the options of a wrapped select", async () => {
    const page = openPage(`<form id="f"><label>Тема<select name="subject"><option>Пробный период</option><option>Вопрос</option></select></label><input name="email" type="email" value="a@example.com"></form>`);

    page.submit(page.window.document.getElementById("f")!);

    expect(page.sent()[0]).toMatchObject({ email: "a@example.com", fields: [{ question: "Тема", value: "Пробный период" }] });
  });

  it("keeps a message whose placeholder happens to contain a contact word", async () => {
    const page = openPage(`<form id="f"><input name="email" type="email" value="a@example.com"><input name="phone" type="tel" value="+375291234567"><textarea name="body" placeholder="Что хотелось бы видеть">Хочу попробовать</textarea></form>`);

    page.submit(page.window.document.getElementById("f")!);

    expect(page.sent()[0]).toMatchObject({ email: "a@example.com", phone: "+375291234567", fields: [{ question: "Что хотелось бы видеть", value: "Хочу попробовать" }] });
  });

  it("sends nothing for a form without a phone or email", async () => {
    const page = openPage(`<form id="f"><input name="q" value="windows"></form>`);

    page.submit(page.window.document.getElementById("f")!);

    expect(page.fetch).not.toHaveBeenCalled();
  });

  it("sends nothing for a form marked off", async () => {
    const page = openPage(contactForm.replace("<form", `<form data-balagan="off"`));

    page.submit(page.window.document.getElementById("f")!);

    expect(page.fetch).not.toHaveBeenCalled();
  });

  it("sends a lead from the page's own code", async () => {
    const page = openPage("");

    (page.window as unknown as { balagan: { lead: (data: object) => void } }).balagan.lead({ name: "Олег", phone: "+375291112233" });

    expect(page.sent()[0]).toMatchObject({ key: KEY, name: "Олег", phone: "+375291112233" });
  });

  it("reports what a bot typed into the hidden field", async () => {
    const page = openPage(contactForm);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const form = page.window.document.getElementById("f") as HTMLFormElement;
    (form.elements.namedItem("balagan_site") as HTMLInputElement).value = "http://spam";

    page.submit(form);

    expect(page.sent()[0]).toMatchObject({ hp: "http://spam" });
  });

  describe("in manual mode", () => {
    it("ignores form submissions and adds no hidden field", async () => {
      const page = openPage(contactForm, "https://shop.example.com/", "manual");
      await new Promise((resolve) => setTimeout(resolve, 0));

      page.submit(page.window.document.getElementById("f")!);

      expect(page.fetch).not.toHaveBeenCalled();
      expect(page.window.document.querySelector('[name="balagan_site"]')).toBeNull();
    });

    it("sends a lead from code with the stored tags and fields given as an object", async () => {
      const page = openPage("", "https://shop.example.com/?utm_campaign=spring", "manual");
      const win = page.window as unknown as { balagan: { lead: (data: object) => Promise<boolean> } };

      const sent = await win.balagan.lead({ name: "Олег", phone: "+375291112233", fields: { Комментарий: "Нужен замер", Пусто: "  " } });

      expect(sent).toBe(true);
      expect(page.sent()[0]).toMatchObject({
        key: KEY, name: "Олег", phone: "+375291112233", utm_campaign: "spring",
        fields: [{ question: "Комментарий", value: "Нужен замер" }],
      });
    });

    it("answers false and does not throw when the request fails", async () => {
      const page = openPage("", "https://shop.example.com/", "manual");
      page.fetch.mockRejectedValue(new Error("offline"));
      const win = page.window as unknown as { balagan: { lead: (data: object) => Promise<boolean> } };

      await expect(win.balagan.lead({ phone: "+375291112233" })).resolves.toBe(false);
    });
  });
});
