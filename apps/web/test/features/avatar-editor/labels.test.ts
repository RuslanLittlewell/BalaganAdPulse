import { avatarChoices } from "@/features/avatar-editor/avatar.js";
import { fieldLabels, optionLabel } from "@/features/avatar-editor/labels.js";

type Field = keyof typeof avatarChoices;
const fields = Object.keys(avatarChoices) as Field[];

describe("avatar labels", () => {
  it("names every control", () => {
    for (const field of fields) {
      expect(fieldLabels[field], field).toBeTruthy();
    }
  });

  it("names every option in Russian, never as a bare number", () => {
    for (const field of fields) {
      for (const option of avatarChoices[field]) {
        const label = optionLabel(field, option);
        expect(label, `${field}.${option}`).toMatch(/[а-яА-ЯёЁ]/);
        expect(label, `${field}.${option}`).not.toMatch(/^Вариант \d+$/);
        // A missing translation falls through to the library's own value.
        expect(label, `${field}.${option}`).not.toBe(option);
      }
    }
  });

  it("gives distinct names within one control", () => {
    for (const field of fields) {
      const labels = avatarChoices[field].map((option) => optionLabel(field, option));
      expect(new Set(labels).size, field).toBe(labels.length);
    }
  });

  it("falls back to the raw value for an option it does not know", () => {
    expect(optionLabel("eyeType", "SomethingNew")).toBe("SomethingNew");
  });
});
