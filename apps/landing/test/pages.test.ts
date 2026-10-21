import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = (path: string) => readFileSync(new URL(`../dist/${path}`, import.meta.url), "utf8");

const textOf = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

const linksOf = (html: string) => [...html.matchAll(/<a[^>]*href="([^"]+)"/g)].map((match) => match[1]);

describe("the home page Google reads", () => {
  const html = page("index.html");
  const text = textOf(html);

  it("names the app as the consent screen does, in its title and heading", () => {
    expect(html).toMatch(/<title>BalaganBI[^<]*<\/title>/);
    expect(textOf(html.match(/<h1[\s\S]*?<\/h1>/)![0]).trim()).toMatch(/^BalaganBI:/);
  });

  it("explains what the app does without any script having to run", () => {
    expect(text).toContain("собирает статистику рекламных кампаний");
    expect(text).toContain("brings campaign statistics from connected ad accounts into one place");
  });

  it("says how a Google Ads account is connected and what is read", () => {
    expect(text).toContain("Войдите в аккаунт Google, у которого есть доступ к кабинету");
    expect(text).toContain("Разрешите BalaganBI доступ к Google Ads");
    expect(text).toContain("BalaganBI только читает данные");
    expect(text).toContain("only reads data; it never creates or changes campaigns");
  });

  it("promises the data is not sold, shared, used for advertising or to train AI", () => {
    expect(text).toContain("не продаём данные, не передаём их третьим лицам, не используем для рекламы и для обучения моделей ИИ");
    expect(text).toContain("not sold, shared with third parties, used for advertising or used to train AI models");
  });

  it("tells how to revoke access", () => {
    expect(text).toContain("myaccount.google.com/permissions");
  });

  it("links to the privacy policy and to the app's sign-in", () => {
    expect(linksOf(html)).toEqual(expect.arrayContaining(["/privacy", "https://app.balagan.pro"]));
  });

  it("presents the app's modules and the ad accounts it connects", () => {
    for (const module of ["Дашборд", "Проекты", "Задачи", "CRM", "Отчёты", "Команда и доступ"]) {
      expect(text).toContain(module);
    }
    expect(text).toContain("Meta");
    expect(text).toContain("Google Ads");
  });

  it("offers every section from its menu", () => {
    for (const anchor of ["features", "modules", "integrations"]) {
      expect(linksOf(html)).toContain(`/#${anchor}`);
      expect(html).toMatch(new RegExp(`id="${anchor}"`));
    }
  });

  it("guides through connecting each provider in its own tab", () => {
    for (const provider of ["meta", "google"]) {
      const tab = html.match(new RegExp(`<button[^>]*role="tab"[^>]*id="tab-${provider}"[^>]*>`))?.[0] ?? "";
      expect(tab).toContain(`aria-controls="guide-${provider}"`);
      expect(html).toMatch(new RegExp(`<section[^>]*id="guide-${provider}"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-${provider}"`));
    }
    expect(text).toContain("Как подключить Meta");
    expect(text).toContain("Как подключить Google Ads");
  });

  it("keeps every guide in the page for a reader without scripts", () => {
    expect(html).not.toMatch(/role="tabpanel"[^>]*hidden/);
    expect(html).toMatch(/role="tablist"[^>]*hidden/);
  });

  it("presents every module in its own tab with a description and an imitation", () => {
    for (const module of ["dashboard", "projects", "tasks", "crm", "reports", "team"]) {
      const tab = html.match(new RegExp(`<button[^>]*role="tab"[^>]*id="module-tab-${module}"[^>]*>`))?.[0] ?? "";
      expect(tab).toContain(`aria-controls="module-${module}"`);
      const start = html.search(new RegExp(`<section[^>]*id="module-${module}"`));
      const panel = html.slice(start, html.indexOf("</section>", html.indexOf("</figure>", start)));
      expect(panel).toMatch(/role="tabpanel"/);
      expect(panel).toContain("<figure");
      expect(panel).toMatch(/<ul[\s\S]*<li/);
    }
  });

  it("presents the modules without sending anyone into the app", () => {
    const modules = html.slice(html.indexOf('id="modules"'), html.indexOf('id="integrations"'));
    expect(linksOf(modules)).toEqual([]);
  });

  it("shows a finished dashboard to a reader without scripts, every project in its KPI zone", () => {
    const demo = html.slice(html.indexOf("<figure data-demo"), html.indexOf("</figure>"));
    const zones = [...demo.matchAll(/data-zone="(met|behind|danger)"/g)].map((match) => match[1]);
    expect(new Set(zones)).toEqual(new Set(["met", "behind", "danger"]));
    const met = zones.filter((zone) => zone === "met").length;
    expect(textOf(demo)).toContain(`${met} из ${zones.length}`);
    expect(demo).not.toContain("data-pending");
    expect(textOf(demo)).toContain("Обновлено сегодня в 08:00");
  });

  it("lets a visitor write to the agency even without scripts", () => {
    expect(html).toMatch(/<form[^>]*action="mailto:balagan\.ads@gmail\.com"/);
  });

  it("is in Russian with an English section", () => {
    expect(html).toMatch(/<html lang="ru">/);
    expect(html).toMatch(/<section[^>]*lang="en"/);
  });
});

describe("the privacy policy", () => {
  const html = page("privacy/index.html");
  const text = textOf(html);

  it("says who provides the service and how to reach them", () => {
    expect(text).toContain("предоставляет рекламное агентство Balagan");
    expect(linksOf(html)).toContain("mailto:balagan.ads@gmail.com");
  });

  it("names the Google permission and what is read with it", () => {
    expect(text).toContain("https://www.googleapis.com/auth/adwords");
    expect(text).toContain("ежедневную статистику: расходы, показы, клики, конверсии и ценность конверсий");
  });

  it("explains storage, revoking and deletion", () => {
    expect(text).toContain("хранится на сервере в зашифрованном виде");
    expect(text).toContain("токен сразу удаляется");
    expect(text).toContain("мы удалим данные в течение 30 дней");
  });

  it("carries the Limited Use statement in both languages", () => {
    expect(text).toContain("соответствует Google API Services User Data Policy , включая требования Limited Use");
    expect(text).toContain("adheres to the Google API Services User Data Policy , including the Limited Use requirements");
    expect(linksOf(html)).toContain("https://developers.google.com/terms/api-services-user-data-policy");
  });
});

describe("a page that does not exist", () => {
  it("has its own not-found page leading home and to the app", () => {
    const html = page("404.html");
    expect(textOf(html)).toContain("Страница не найдена");
    expect(linksOf(html)).toEqual(expect.arrayContaining(["/", "https://app.balagan.pro"]));
  });
});
