import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { buildActivity, type ActivityField, type LeadHistoryEvent } from "../../src/modules/leads/domain/lead-activity.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs, type SignedIn } from "../helpers/auth.js";

const SEGMENT: ActivityField = {
  id: "segment", name: "Сегмент", type: "SELECT",
  options: [{ id: "o1", name: "Опт", color: "blue" }, { id: "o2", name: "Розница", color: "green" }],
};
const FIELDS: ActivityField[] = [
  { id: "budget", name: "Бюджет", type: "NUMBER", options: [] },
  SEGMENT,
  { id: "qualified", name: "Квалифицирован", type: "CHECKBOX", options: [] },
  { id: "channels", name: "Каналы", type: "MULTI_SELECT", options: [{ id: "c1", name: "Сайт", color: "teal" }] },
];

const change = (before: Record<string, unknown>, after: Record<string, unknown>): LeadHistoryEvent[] => [{
  id: "e1", action: "UPDATE", actorName: "Мария", createdAt: new Date("2026-11-07T10:00:00Z"),
  changes: { before: { name: "Леонид", customValues: before }, after: { name: "Леонид", customValues: after } },
}];

const changesOf = (events: LeadHistoryEvent[], fields = FIELDS) => {
  const [entry] = buildActivity("lead", events, { columns: new Map(), campaigns: new Map(), fields }, null);
  return entry && "changes" in entry ? entry.changes : [];
};

describe("custom field changes in the activity", () => {
  it("names the field and gives list values as option names", () => {
    expect(changesOf(change({ segment: "o1", budget: "1.0000" }, { segment: "o2", budget: "1.0000" }))).toEqual([
      { field: "custom", fieldId: "segment", name: "Сегмент", type: "SELECT", before: ["Опт"], after: ["Розница"] },
    ]);
  });

  it("gives a checkbox as true or false and an empty value as null", () => {
    expect(changesOf(change({}, { qualified: true, budget: "5.0000" }))).toEqual([
      { field: "custom", fieldId: "budget", name: "Бюджет", type: "NUMBER", before: null, after: "5.0000" },
      { field: "custom", fieldId: "qualified", name: "Квалифицирован", type: "CHECKBOX", before: false, after: true },
    ]);
  });

  it("shows an option that no longer exists as null", () => {
    expect(changesOf(change({ channels: ["c1", "gone"] }, { channels: ["c1"] }))).toEqual([
      { field: "custom", fieldId: "channels", name: "Каналы", type: "MULTI_SELECT", before: ["Сайт", null], after: ["Сайт"] },
    ]);
  });

  it("skips changes of a field that no longer exists", () => {
    expect(buildActivity("lead", change({ budget: "1.0000" }, { budget: "2.0000" }), { columns: new Map(), campaigns: new Map(), fields: [SEGMENT] }, null)).toEqual([]);
  });

  it("reads snapshots stored before custom fields existed", () => {
    const events: LeadHistoryEvent[] = [{
      id: "e1", action: "UPDATE", actorName: "Мария", createdAt: new Date(),
      changes: { before: { name: "Леонид", phone: "1" }, after: { name: "Леонид", phone: "2" } },
    }];

    expect(changesOf(events)).toEqual([{ field: "phone", before: "1", after: "2" }]);
  });
});

describe("the activity of a lead with custom fields", () => {
  const app = createApp();
  let admin: SignedIn;
  let projectId: string;

  beforeEach(async () => {
    await resetDb();
    admin = await signInAs("Женя Радюк");
    ({ projectId } = await seedProject(admin.user.id));
  });

  afterAll(() => prisma.$disconnect());

  it("lists a value change under the field's current name, then forgets it once the field is deleted", async () => {
    const board = `/api/crm/boards/${projectId}`;
    const field = (await request(app).post(`${board}/fields`).set(admin.auth).send({
      name: "Сегмент", type: "SELECT", options: [{ name: "Опт", color: "blue" }, { name: "Розница", color: "green" }],
    }).expect(201)).body;
    const [wholesale, retail] = field.options;
    const lead = (await request(app).post(`${board}/leads`).set(admin.auth).send({ name: "Леонид", customValues: { [field.id]: wholesale.id } }).expect(201)).body;
    await request(app).patch(`${board}/leads/${lead.id}`).set(admin.auth).send({ customValues: { [field.id]: retail.id } }).expect(200);
    await request(app).patch(`${board}/fields/${field.id}`).set(admin.auth).send({ name: "Тип клиента" }).expect(200);

    const listed = (await request(app).get(`${board}/leads/${lead.id}/activity`).set(admin.auth).expect(200)).body;

    expect(listed[0]).toMatchObject({
      kind: "changed", actor: { name: "Женя Радюк" },
      changes: [{ field: "custom", fieldId: field.id, name: "Тип клиента", type: "SELECT", before: ["Опт"], after: ["Розница"] }],
    });

    await request(app).delete(`${board}/fields/${field.id}`).set(admin.auth).expect(204);
    const after = (await request(app).get(`${board}/leads/${lead.id}/activity`).set(admin.auth).expect(200)).body;
    expect(after.map((entry: { kind: string }) => entry.kind)).toEqual(["created"]);
  });
});
