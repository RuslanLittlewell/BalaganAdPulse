import { tariffRefusal, trialDaysLeft, usageLabel } from "@/entities/tariff/index.js";
import { ApiError } from "@/shared/lib/index.js";

describe("a tariff refusal", () => {
  it("names the reached limit in Russian", () => {
    const error = new ApiError("Tariff limit reached for projects: 5.", 403, [
      { code: "TARIFF_LIMIT", resource: "projects", limit: 5 },
    ]);
    expect(tariffRefusal(error))
      .toBe("Достигнут лимит тарифа «Проекты»: 5. Чтобы добавить больше, смените тариф.");
  });

  it("says the trial has ended", () => {
    const error = new ApiError("The trial has ended.", 403, [{ code: "TRIAL_ENDED" }]);
    expect(tariffRefusal(error)).toBe("Пробный период закончился, изменения недоступны.");
  });

  it("leaves any other failure to the form", () => {
    expect(tariffRefusal(new ApiError("Forbidden", 403))).toBeNull();
    expect(tariffRefusal(new ApiError("Conflict", 409, [{ code: "TARIFF_LIMIT", resource: "projects", limit: 5 }]))).toBeNull();
    expect(tariffRefusal(new ApiError("Odd", 403, [{ code: "TARIFF_LIMIT", resource: "planets", limit: 5 }]))).toBeNull();
    expect(tariffRefusal(new Error("network"))).toBeNull();
  });
});

describe("tariff figures", () => {
  it("reads usage against a limit, or without one", () => {
    expect(usageLabel(4, 15)).toBe("4 из 15");
    expect(usageLabel(7, null)).toBe("7, без ограничений");
  });

  it("counts the trial days left, rounding up and never below zero", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    expect(trialDaysLeft("2026-11-12T10:00:00Z", now)).toBe(6);
    expect(trialDaysLeft("2026-11-06T13:00:00Z", now)).toBe(1);
    expect(trialDaysLeft("2026-11-01T00:00:00Z", now)).toBe(0);
  });
});
