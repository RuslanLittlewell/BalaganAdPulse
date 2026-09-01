import { t } from "@/shared/config/ru.js";

describe("t", () => {
  it("returns the Russian copy for a key", () => {
    expect(t("clients.section")).toBe("Клиенты");
    expect(t("action.create")).toBe("Создать");
  });
});
