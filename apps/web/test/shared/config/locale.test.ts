import { en } from "@/shared/config/en.js";
import { ru, t } from "@/shared/config/ru.js";
import { getIntlLocale, getLocale, initializeLocale, saveLocale } from "@/shared/config/locale.js";
import { formatCompactCount, formatDay, formatNumber } from "@/shared/lib/index.js";

afterEach(() => {
  localStorage.removeItem("adpulse.language");
  localStorage.removeItem("adpulse.profile.locale-test.campaignCrm");
  document.documentElement.lang = "ru";
  vi.restoreAllMocks();
});

describe("interface language", () => {
  it("has an English translation for every Russian message", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
    expect(Object.values(en).every((value) => value.trim() !== "")).toBe(true);
    expect(Object.entries(en).filter(([key, value]) => key !== "language.ru" && /[а-яё]/i.test(value))).toEqual([]);
  });

  it("defaults to Russian and ignores unsupported stored languages", () => {
    localStorage.removeItem("adpulse.language");
    expect(getLocale()).toBe("ru");
    localStorage.setItem("adpulse.language", "de");
    initializeLocale();
    expect(document.documentElement.lang).toBe("ru");
    expect(t("nav.projects")).toBe("Проекты");
  });

  it("retains English and uses English copy, numbers and dates", () => {
    expect(saveLocale("en")).toBe(true);
    expect(saveLocale("en")).toBe(false);
    expect(getLocale()).toBe("en");
    expect(getIntlLocale()).toBe("en-US");
    expect(document.documentElement.lang).toBe("en");
    expect(t("nav.projects")).toBe("Projects");
    expect(t("telegram.connect")).toBe("Connect");
    expect(formatDay("2026-11-16")).toContain("Nov");
    expect(formatNumber(1234.5)).toBe("1,234.5");
    expect(formatCompactCount(25000)).toBe("25K");
    expect(saveLocale("ru")).toBe(true);
    expect(t("nav.projects")).toBe("Проекты");
  });

  it("initializes avatar labels in English after loading the selected language", async () => {
    saveLocale("en");
    vi.resetModules();
    const { fieldLabels, optionLabel } = await import("@/features/avatar-editor/labels.js");
    expect(fieldLabels.topType).toBe("Hair / headwear");
    expect(optionLabel("topType", "NoHair")).toBe("No hair");
    expect(optionLabel("skinColor", "Black")).toBe("Deep");
  });

  it("uses defaults when browser storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    expect(getLocale()).toBe("ru");
  });
});
