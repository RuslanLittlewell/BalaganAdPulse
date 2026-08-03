import { t } from "./en.js";

describe("t", () => {
  it("returns the English copy for a key", () => {
    expect(t("clients.section")).toBe("Clients");
    expect(t("action.create")).toBe("Create");
  });
});
