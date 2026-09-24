import { describe, expect, it } from "vitest";
import { mapLeadAnswers } from "../../src/modules/integrations/infrastructure/meta-lead-answers.js";

const answer = (name: string, ...values: string[]) => ({ name, values });

describe("mapping Instant Form answers onto a lead", () => {
  it("fills name, phone, email and company from a standard contact form and keeps every answer in order", () => {
    const mapped = mapLeadAnswers("L1", [
      answer("full_name", "Анна Петрова"),
      answer("phone_number", "+375291234567"),
      answer("email", "anna@example.com"),
      answer("company_name", "Клиника"),
    ]);

    expect(mapped).toEqual({
      name: "Анна Петрова", phone: "+375291234567", email: "anna@example.com", company: "Клиника",
      answers: [
        { question: "full_name", values: ["Анна Петрова"] },
        { question: "phone_number", values: ["+375291234567"] },
        { question: "email", values: ["anna@example.com"] },
        { question: "company_name", values: ["Клиника"] },
      ],
      answersOmitted: false,
    });
  });

  it("joins first and last name when there is no full name", () => {
    expect(mapLeadAnswers("L1", [answer("first_name", "Анна"), answer("last_name", "Петрова")]).name).toBe("Анна Петрова");
    expect(mapLeadAnswers("L1", [answer("first_name", "Анна")]).name).toBe("Анна");
  });

  it("falls back to the phone, then the email, then the Meta lead identifier for a name", () => {
    expect(mapLeadAnswers("L1", [answer("phone_number", "+375291234567"), answer("email", "a@example.com")]).name).toBe("+375291234567");
    expect(mapLeadAnswers("L1", [answer("email", "a@example.com")]).name).toBe("a@example.com");
    expect(mapLeadAnswers("L1", [answer("budget", "1000")]).name).toBe("L1");
  });

  it("uses work phone and work email only when the personal ones are absent", () => {
    expect(mapLeadAnswers("L1", [answer("work_phone_number", "+48123"), answer("work_email", "w@example.com")]))
      .toMatchObject({ phone: "+48123", email: "w@example.com" });
    expect(mapLeadAnswers("L1", [
      answer("work_phone_number", "+48123"), answer("phone_number", "+375291234567"),
      answer("work_email", "w@example.com"), answer("email", "a@example.com"),
    ])).toMatchObject({ phone: "+375291234567", email: "a@example.com" });
  });

  it("leaves invalid or oversized values out of contact fields but keeps them as answers", () => {
    const mapped = mapLeadAnswers("L1", [
      answer("full_name", "x".repeat(201)),
      answer("first_name", "Анна"),
      answer("phone_number", "9".repeat(51)),
      answer("email", "not-an-address"),
      answer("company_name", "c".repeat(201)),
    ]);

    expect(mapped).toMatchObject({ name: "Анна", phone: null, email: null, company: null });
    expect(mapped.answers.map((item) => item.question)).toEqual(["full_name", "first_name", "phone_number", "email", "company_name"]);
    expect(mapped.answers[3]).toEqual({ question: "email", values: ["not-an-address"] });
  });

  it("trims values and ignores blank ones", () => {
    expect(mapLeadAnswers("L1", [answer("full_name", "   "), answer("phone_number", "  +375291234567 ")]))
      .toMatchObject({ name: "+375291234567", phone: "+375291234567" });
  });

  it("fills no contact field from a custom question", () => {
    const mapped = mapLeadAnswers("L1", [answer("какой_у_вас_бюджет?", "до 1000", "срочно")]);

    expect(mapped).toMatchObject({ name: "L1", phone: null, email: null, company: null });
    expect(mapped.answers).toEqual([{ question: "какой_у_вас_бюджет?", values: ["до 1000", "срочно"] }]);
  });

  it("keeps at most 100 answers and says the rest were omitted", () => {
    const many = Array.from({ length: 101 }, (_, index) => answer(`q${index}`, "a"));

    const mapped = mapLeadAnswers("L1", many);

    expect(mapped.answers).toHaveLength(100);
    expect(mapped.answers.at(-1)?.question).toBe("q99");
    expect(mapped.answersOmitted).toBe(true);
    expect(mapLeadAnswers("L1", many.slice(0, 100)).answersOmitted).toBe(false);
  });

  it("keeps at most 10000 characters of answer text and still maps contacts from what was dropped", () => {
    const mapped = mapLeadAnswers("L1", [
      answer("about", "x".repeat(6000)),
      answer("details", "y".repeat(4000)),
      answer("more", "z"),
      answer("phone_number", "+375291234567"),
    ]);

    expect(mapped.answers.map((item) => item.question)).toEqual(["about", "details"]);
    expect(mapped.answersOmitted).toBe(true);
    expect(mapped.phone).toBe("+375291234567");
  });

  it.each(["Phone", "phone", "tel", "Contact number", "Телефон", "Ваш номер телефона", "mobile_phone"])(
    "takes the phone from a custom %s question when there is no standard one",
    (question) => {
      const mapped = mapLeadAnswers("L1", [answer("full_name", "Анна"), answer(question, "+375 (29) 123-45-67")]);
      expect(mapped.phone).toBe("+375 (29) 123-45-67");
      expect(mapped.answers).toContainEqual({ question, values: ["+375 (29) 123-45-67"] });
    },
  );

  it("prefers the standard phone answers to a custom question", () => {
    expect(mapLeadAnswers("L1", [answer("Phone", "+48 111 222 333"), answer("phone_number", "+375291234567")]).phone)
      .toBe("+375291234567");
    expect(mapLeadAnswers("L1", [answer("Phone", "+48 111 222 333"), answer("work_phone_number", "+375291234567")]).phone)
      .toBe("+375291234567");
  });

  it("takes the first phone-like custom question in form order", () => {
    expect(mapLeadAnswers("L1", [answer("tel", "+48 111 222 333"), answer("Phone", "+375291234567")]).phone)
      .toBe("+48 111 222 333");
  });

  it("fills no phone from Telegram or from an answer that is not a phone number", () => {
    expect(mapLeadAnswers("L1", [
      answer("Telegram", "+375291234567"),
      answer("number_of_employees", "50"),
      answer("Phone", "позвоните вечером"),
    ]).phone).toBeNull();
  });

  it("names a lead by a phone found in a custom question when nothing else names it", () => {
    expect(mapLeadAnswers("L1", [answer("Телефон", "+375291234567")]).name).toBe("+375291234567");
  });
});
