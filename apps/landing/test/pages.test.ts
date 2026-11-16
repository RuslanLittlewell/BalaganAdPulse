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

  it("loads the lead intake script with the project key", () => {
    expect(html).toMatch(/<script[^>]*src="https:\/\/app\.balagan\.pro\/api\/intake\/script\.js"[^>]*data-key="bk_[A-Za-z0-9_-]{32}"/);
  });

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

  it("lists every module with a description, its points and an imitation, without any script", () => {
    for (const module of ["dashboard", "projects", "tasks", "crm", "reports", "team"]) {
      const start = html.search(new RegExp(`<article[^>]*id="module-${module}"`));
      expect(start).toBeGreaterThan(-1);
      const article = html.slice(start, html.indexOf("</article>", start));
      expect(article).toMatch(/<h3[^>]*id="module-title-/);
      expect(article).toContain("<figure");
      expect(article).toMatch(/<ul[\s\S]*<li/);
    }
    expect(html).not.toMatch(/id="module-tab-/);
  });

  it("offers the module names to jump between only once the deck runs", () => {
    expect(html).toMatch(/<div[^>]*data-deck-nav[^>]*hidden/);
    const steps = [...html.matchAll(/<button[^>]*data-deck-step="(\d)"[^>]*aria-controls="module-([a-z]+)"/g)];
    expect(steps.map((step) => step[2])).toEqual(["dashboard", "projects", "tasks", "crm", "reports", "team"]);
  });

  it("presents the modules without sending anyone into the app", () => {
    const modules = html.slice(html.indexOf('id="modules"'), html.indexOf('id="integrations"'));
    expect(linksOf(modules)).toEqual([]);
  });

  it("shows a finished dashboard to a reader without scripts, every project in its KPI zone", () => {
    const demo = html.slice(html.indexOf("<figure data-demo"), html.indexOf("</figure>"));
    const zones = [...demo.matchAll(/data-zone="(met|behind|danger|none)"/g)].map((match) => match[1]);
    expect(new Set(zones)).toEqual(new Set(["met", "behind", "danger", "none"]));
    const met = zones.filter((zone) => zone === "met").length;
    expect(textOf(demo)).toContain(`${met} из ${zones.length}`);
    expect(demo).not.toContain("data-pending");
    expect(textOf(demo)).toContain("Обновлено сегодня в 08:00");
  });

  it("offers a free trial and signing in right under the heading", () => {
    const opening = html.slice(html.indexOf("<h1"), html.indexOf("<figure data-demo"));
    expect(linksOf(opening)).toEqual(expect.arrayContaining(["/#contact", "https://app.balagan.pro"]));
    expect(textOf(opening)).toContain("Попробовать бесплатно");
    expect(opening).toMatch(/<a[^>]*href="\/#contact"[^>]*data-contact-topic="Пробный период"/);
  });

  it("lets a visitor ask for a trial in the contact form", () => {
    const form = html.slice(html.indexOf("<form data-contact"), html.indexOf("</form>"));
    expect(form).toMatch(/<option>Пробный период<\/option>/);
    expect(html).not.toMatch(/href="[^"]*(signup|register)/);
  });

  it("totals the month in the dashboard imitation from the projects it lists", () => {
    const demo = html.slice(html.indexOf("<figure data-demo"), html.indexOf("</figure>", html.indexOf("<figure data-demo")));
    const tile = (metric: string) => Number(demo.match(new RegExp(`data-total="${metric}"[\\s\\S]*?data-count="(\\d+)"`))?.[1]);
    const rows = [...demo.matchAll(/<li[^>]*data-row[\s\S]*?<\/li>/g)].map((match) =>
      [...match[0].matchAll(/data-count="(\d+)"/g)].map((count) => Number(count[1])));

    expect(textOf(demo)).toMatch(/Расход[\s\S]*Показы[\s\S]*Клики[\s\S]*Лиды/);
    expect(tile("spend")).toBe(rows.reduce((sum, row) => sum + row[0], 0));
    expect(tile("leads")).toBe(rows.reduce((sum, row) => sum + row[1], 0));
  });

  it("offers the trial again where it explains connecting accounts", () => {
    const section = html.slice(html.indexOf('id="integrations"'), html.indexOf('id="english"'));
    expect(section).toMatch(/<a[^>]*href="\/#contact"[^>]*data-contact-topic="Пробный период"[^>]*>[\s\S]*?Попробовать бесплатно/);
  });

  it("names the integrations BalaganBI has and the ones coming", () => {
    const section = html.slice(html.indexOf('id="integrations"'), html.indexOf('id="english"'));
    const connections = textOf(section.slice(section.indexOf('aria-label="Подключения"'), section.indexOf("</ul>", section.indexOf('aria-label="Подключения"'))));
    for (const name of ["Meta Ads", "Google Ads", "Search Console", "Telegram"]) {
      expect(connections).toMatch(new RegExp(`${name}(?! · скоро)`));
    }
    for (const name of ["Яндекс Директ", "TikTok Ads"]) {
      expect(connections).toContain(`${name} · скоро`);
    }
  });

  it("lets a visitor write to the agency even without scripts", () => {
    expect(html).not.toMatch(/<form[^>]*action="mailto:/);
    expect(html).toMatch(/<noscript>[\s\S]*href="mailto:balagan\.ads@gmail\.com"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it("lets a visitor choose the colour scheme from the header, before first paint", () => {
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(header.indexOf("data-theme-toggle")).toBeGreaterThan(-1);
    expect(header.indexOf("data-theme-toggle")).toBeLessThan(header.indexOf('aria-label="BalaganBI"'));
    expect(html.slice(0, html.indexOf("</head>"))).toContain('localStorage.getItem("theme")');
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

describe("the files agents and search engines read", () => {
  it("lets search engines and AI assistants read the site and points them at the sitemap", () => {
    const robots = readFileSync(new URL("../dist/robots.txt", import.meta.url), "utf8");
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      expect(robots).toContain(`User-agent: ${bot}`);
    }
    expect(robots).toContain("Sitemap: https://bi.balagan.pro/sitemap.xml");
  });

  it("describes the product in llms.txt with links to the home page and the policy", () => {
    const llms = page("llms.txt");
    expect(llms).toMatch(/^# BalaganBI/m);
    expect(llms).toContain("https://bi.balagan.pro/");
    expect(llms).toContain("https://bi.balagan.pro/privacy/");
    expect(llms).toContain("https://www.googleapis.com/auth/adwords");
  });

  it("lists the public pages in the sitemap", () => {
    const sitemap = readFileSync(new URL("../dist/sitemap.xml", import.meta.url), "utf8");
    expect(sitemap).toContain("<loc>https://bi.balagan.pro/</loc>");
    expect(sitemap).toContain("<loc>https://bi.balagan.pro/privacy/</loc>");
  });
});
