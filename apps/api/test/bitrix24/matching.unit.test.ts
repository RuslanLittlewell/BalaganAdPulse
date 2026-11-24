import { describe, expect, it } from "vitest";
import {
  companiesMatch,
  contactsMatch,
  emailKey,
  hostKey,
  leadNamesMatch,
  nameKey,
  phoneKey,
} from "../../src/modules/bitrix24/domain/matching.js";

describe("the keys", () => {
  it("keeps only the digits of a phone", () => {
    expect(phoneKey("+375 (29) 111-22-33")).toBe("375291112233");
    expect(phoneKey("375291112233")).toBe("375291112233");
    expect(phoneKey("нет")).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });

  it("trims an email and ignores its case", () => {
    expect(emailKey(" Anna@Example.com ")).toBe("anna@example.com");
    expect(emailKey("  ")).toBeNull();
  });

  it("trims a name and ignores its case", () => {
    expect(nameKey("  Лода ")).toBe("лода");
    expect(nameKey("")).toBeNull();
  });

  it("takes the host of a website without the scheme, www and path", () => {
    expect(hostKey("https://www.Example.com/about?x=1")).toBe("example.com");
    expect(hostKey("example.com")).toBe("example.com");
    expect(hostKey("http://shop.example.com")).toBe("shop.example.com");
    expect(hostKey("ftp://example.com")).toBeNull();
    expect(hostKey("")).toBeNull();
    expect(hostKey(null)).toBeNull();
  });
});

describe("contacts", () => {
  it("match on a phone written in another format", () => {
    expect(contactsMatch({ phone: "+375 (29) 111-22-33", email: null }, { phone: "375291112233", email: null })).toBe(true);
  });

  it("match on an email in another case", () => {
    expect(contactsMatch({ phone: null, email: "Anna@Example.com" }, { phone: null, email: "anna@example.com" })).toBe(true);
  });

  it("match when only one of the two agrees", () => {
    expect(contactsMatch({ phone: "111", email: "a@x.by" }, { phone: "222", email: "A@x.by" })).toBe(true);
  });

  it("do not match without a phone or an email in common, and never on two empty values", () => {
    expect(contactsMatch({ phone: "111", email: "a@x.by" }, { phone: "222", email: "b@x.by" })).toBe(false);
    expect(contactsMatch({ phone: null, email: null }, { phone: null, email: null })).toBe(false);
  });
});

describe("companies", () => {
  it("match on the name, ignoring case and surrounding spaces", () => {
    expect(companiesMatch({ name: "Лода ", website: null }, { name: "лода", website: null })).toBe(true);
  });

  it("match on the website host when the names differ", () => {
    expect(companiesMatch({ name: "Лода", website: "https://www.loda.by/" }, { name: "ООО Лода", website: "loda.by" })).toBe(true);
  });

  it("do not match on different names and hosts, or on two missing websites", () => {
    expect(companiesMatch({ name: "Лода", website: "loda.by" }, { name: "Евроопт", website: "e.by" })).toBe(false);
    expect(companiesMatch({ name: "Лода", website: null }, { name: "Евроопт", website: null })).toBe(false);
  });
});

describe("lead names", () => {
  it("ignore case and surrounding spaces", () => {
    expect(leadNamesMatch(" Анна", "анна ")).toBe(true);
    expect(leadNamesMatch("Анна", "Анна К")).toBe(false);
  });
});
