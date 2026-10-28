import { describe, expect, it } from "vitest";
import { loginOf, loginPrefix } from "../../src/modules/client-accounts/domain/client-account.js";

describe("a login prefix", () => {
  it("writes a Cyrillic name in Latin letters joined by hyphens", () => {
    expect(loginPrefix("Клиника Здоровье")).toBe("klinika-zdorove");
  });

  it("spells out letters that take more than one Latin letter", () => {
    expect(loginPrefix("Щука и Ёжик")).toBe("shchuka-i-ezhik");
    expect(loginPrefix("Цех Юла")).toBe("tsekh-yula");
  });

  it("writes Belarusian letters too", () => {
    expect(loginPrefix("Ўсход і Захад")).toBe("uskhod-i-zakhad");
  });

  it("keeps Latin letters and digits, lowercased, without accents", () => {
    expect(loginPrefix("Café «Acme» 24/7")).toBe("cafe-acme-24-7");
  });

  it("is at most twenty characters and never ends in a hyphen", () => {
    const prefix = loginPrefix("Международный медицинский центр");
    expect(prefix).toBe("mezhdunarodnyy-medit");
    expect(loginPrefix("Автосалон на Победителей")).toBe("avtosalon-na-pobedit");
    expect(loginPrefix("Abcdefghijklmnopqrs tuv")).toBe("abcdefghijklmnopqrs");
  });

  it("falls back to client when nothing can be written", () => {
    expect(loginPrefix("—")).toBe("client");
    expect(loginPrefix("   ")).toBe("client");
    expect(loginPrefix("24/7")).toBe("24-7");
    expect(loginPrefix("№ 1")).toBe("no-1");
  });

  it("never carries an @", () => {
    expect(loginPrefix("info@acme.by")).toBe("info-acme-by");
  });
});

describe("a login", () => {
  it("joins the prefix and the digits with a hyphen and ends with the agency's domain", () => {
    expect(loginOf("klinika", "4821")).toBe("klinika-4821@balagan.pro");
  });
});
