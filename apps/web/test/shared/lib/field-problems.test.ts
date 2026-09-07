import { ApiError, fieldProblems } from "@/shared/lib/index.js";

const rejection = (details: unknown[]) => new ApiError("Validation error", 400, details);

describe("what the server says is wrong with a field", () => {
  it("reads a missing value as a required field", () => {
    const problems = fieldProblems(rejection([
      {
        origin: "string", code: "too_small", minimum: 1, inclusive: true,
        path: ["title"], message: "title is required",
      },
    ]));

    expect(problems).toEqual({ title: "Обязательное поле" });
  });

  it("reads an absent property as a required field too", () => {
    const problems = fieldProblems(rejection([
      { code: "invalid_type", expected: "string", path: ["title"], message: "Invalid input" },
    ]));

    expect(problems).toEqual({ title: "Обязательное поле" });
  });

  it("says a value needs checking when it cannot say more", () => {
    const problems = fieldProblems(rejection([
      { code: "invalid_format", format: "uuid", path: ["projectId"], message: "not a uuid" },
    ]));

    expect(problems).toEqual({ projectId: "Проверьте значение" });
  });

  it("names a nested field by its path", () => {
    const problems = fieldProblems(rejection([
      { code: "invalid_type", path: ["grants", 0, "clientId"], message: "Invalid input" },
    ]));

    expect(problems).toEqual({ "grants.0.clientId": "Обязательное поле" });
  });

  it("keeps the first thing said about a field", () => {
    const problems = fieldProblems(rejection([
      { code: "too_small", origin: "string", minimum: 1, path: ["title"] },
      { code: "invalid_format", path: ["title"] },
    ]));

    expect(problems).toEqual({ title: "Обязательное поле" });
  });

  it("has nothing to say about a failure that named no field", () => {
    expect(fieldProblems(rejection([{ code: "custom", message: "nope" }]))).toEqual({});
    expect(fieldProblems(rejection([]))).toEqual({});
    expect(fieldProblems(new Error("network"))).toEqual({});
    expect(fieldProblems(null)).toEqual({});
  });
});
