import { describe, it, expect } from "vitest";
import {
  TEST_RUN_ID_ENV,
  currentRunId,
  databaseUrlForWorker,
  generateRunId,
  runIdCreatedAt,
  schemaNameForWorker,
} from "./workers.js";

describe("generateRunId", () => {
  it("encodes the creation time so orphans can be swept", () => {
    const now = 1_755_600_000_000;
    expect(runIdCreatedAt(generateRunId(now))).toBe(now);
  });

  it("differs between two runs started in the same millisecond", () => {
    const now = 1_755_600_000_000;
    expect(generateRunId(now)).not.toBe(generateRunId(now));
  });

  it("stays inside Postgres's 63-character identifier limit", () => {
    expect(schemaNameForWorker(4, generateRunId()).length).toBeLessThan(63);
  });
});

describe("schemaNameForWorker", () => {
  it("gives each worker of a run its own schema", () => {
    const runId = generateRunId();
    expect(schemaNameForWorker(1, runId)).not.toBe(schemaNameForWorker(2, runId));
  });

  it("gives two runs different schemas for the same worker", () => {
    expect(schemaNameForWorker(1, generateRunId())).not.toBe(
      schemaNameForWorker(1, generateRunId()),
    );
  });
});

describe("currentRunId", () => {
  it("reads the id from the environment", () => {
    expect(currentRunId({ [TEST_RUN_ID_ENV]: "abc123" })).toBe("abc123");
  });

  it("throws when the id is absent, rather than sharing a schema", () => {
    expect(() => currentRunId({})).toThrow(/ADPULSE_TEST_RUN_ID/);
  });
});

describe("databaseUrlForWorker", () => {
  it("points the url at this worker's schema", () => {
    const url = databaseUrlForWorker(
      2,
      "abc123",
      "postgresql://postgres:postgres@localhost:5432/adpulse_test?schema=public",
    );
    expect(new URL(url).searchParams.get("schema")).toBe(schemaNameForWorker(2, "abc123"));
  });

  it("throws without a base url", () => {
    expect(() => databaseUrlForWorker(1, "abc123", "")).toThrow(/DATABASE_URL/);
  });
});
