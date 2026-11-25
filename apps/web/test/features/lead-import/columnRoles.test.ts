import { assignRole, proposeRoles, rowsOf } from "@/features/lead-import/lib/columnRoles.js";
import { decodeCsv } from "@/features/lead-import/lib/decode.js";

const GEALAN = [
  "platform", "status", "name", "email", "phone", "What stage are you at?", "_fbc", "_fbp", "dt_created", "href", "userAgent",
  "fbclid", "referrer", "ip", "city", "consent_pd", "utm_campaign", "utm_content", "utm_id", "utm_medium", "utm_source", "utm_term",
];

describe("proposing column roles", () => {
  it("reads the Gealan sheet", () => {
    expect(proposeRoles(GEALAN)).toEqual([
      "answer", "status", "name", "email", "phone", "answer", "skip", "skip", "submittedAt", "pageUrl", "skip",
      "skip", "referrer", "skip", "answer", "skip", "utmCampaign", "utmContent", "campaign", "utmMedium", "utmSource", "utmTerm",
    ]);
  });

  it("reads Russian names and prefers a campaign ID over a campaign name", () => {
    expect(proposeRoles(["ФИО", "Телефон", "Почта", "Дата заявки", "Кампания", "Campaign ID", "Этап", ""])).toEqual([
      "name", "phone", "email", "submittedAt", "answer", "campaign", "status", "skip",
    ]);
  });

  it("gives a role held by one column to the column chosen last", () => {
    const roles = proposeRoles(["name", "Contact"]);

    expect(assignRole(roles, 1, "name")).toEqual(["skip", "name"]);
    expect(assignRole(roles, 1, "answer")).toEqual(["name", "answer"]);
  });
});

describe("mapping rows", () => {
  it("fills the mapped fields and turns answer columns with a value into answers", () => {
    const table = { columns: ["name", "phone", "Stage?", "", "fbclid"], rows: [["Ann", " +1 555 ", "Ready", "x", "abc"], ["Bob", "", "", "", ""]] };

    const rows = rowsOf(table, proposeRoles(table.columns));

    expect(rows[0]).toMatchObject({ name: "Ann", phone: "+1 555", email: null, campaign: null, answers: [{ question: "Stage?", values: ["Ready"] }] });
    expect(rows[1]).toMatchObject({ name: "Bob", phone: null, answers: [] });
  });
});

describe("decoding a file", () => {
  it("reads UTF-8 and falls back to Windows-1251", () => {
    const utf8 = new TextEncoder().encode("Имя;Телефон");
    const cp1251 = new Uint8Array([0xc8, 0xec, 0xff, 0x3b, 0xd2, 0xe5, 0xeb, 0xe5, 0xf4, 0xee, 0xed]);

    expect(decodeCsv(utf8.buffer)).toBe("Имя;Телефон");
    expect(decodeCsv(cp1251.buffer)).toBe("Имя;Телефон");
  });
});
