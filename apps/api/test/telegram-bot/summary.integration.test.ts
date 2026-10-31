import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { createKernel } from "../../src/composition/wiring/kernel.js";
import { wireNotifications } from "../../src/composition/wiring/notifications.js";
import { wireClientsAndProjects } from "../../src/composition/wiring/clients-projects.js";
import { wireMembersAndPresence } from "../../src/composition/wiring/members-presence.js";
import { wireLeads } from "../../src/composition/wiring/leads.js";
import { wireCampaignsAndIntegrations } from "../../src/composition/wiring/campaigns-integrations.js";
import { summaryReads } from "../../src/composition/wiring/telegram-bot.js";
import { createSummaryUseCases } from "../../src/modules/telegram-bot/index.js";
import { PrismaTelegramLinks, PrismaTelegramMembers } from "../../src/modules/telegram-bot/infrastructure/prisma-telegram.js";
import { grantAccess, signInAs } from "../helpers/auth.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";

const ANNA = 4242;
const BORIS = 4343;

const kernel = createKernel();
const notices = wireNotifications(kernel);
const catalog = wireClientsAndProjects(kernel, notices);
const people = wireMembersAndPresence(kernel, catalog);
const leads = wireLeads(kernel, people);
const advertising = wireCampaignsAndIntegrations(kernel, {
  projectRepository: catalog.projectRepository,
  leadIntake: leads.leadIntake,
}, notices);
const links = new PrismaTelegramLinks(prisma);

const summaries = createSummaryUseCases({
  links,
  members: new PrismaTelegramMembers(prisma),
  reads: summaryReads({
    projects: catalog.projectRepository,
    clients: catalog.clientRepository,
    campaigns: advertising.campaignUseCases,
  }),
  clock: { now: () => new Date("2026-10-20T09:00:00Z") },
  timeZone: "Europe/Minsk",
});

let projectId: string;
let otherProjectId: string;

async function link(membershipId: string, chatId: number) {
  await links.issueToken(membershipId, `hash-${chatId}`, new Date(Date.now() + 60_000));
  await links.redeem(`hash-${chatId}`, new Date(), { id: chatId, username: null });
}

beforeEach(async () => {
  await resetDb();
  const anna = await signInAs("Анна");
  const boris = await signInAs("Борис", { role: "MANAGER" });
  let clientId: string;
  ({ projectId, clientId } = await seedProject("unused", "Евроопт"));
  ({ projectId: otherProjectId } = await seedProject("unused", "Гиппо"));
  await prisma.project.update({ where: { id: projectId }, data: { budgetCurrency: "RUB" } });
  const campaign = await seedCampaign(projectId, "Поиск", "META");
  await prisma.campaignDailyMetric.create({
    data: {
      campaignId: campaign.id, date: new Date("2026-10-05T00:00:00.000Z"),
      spend: 1000, impressions: 50000, clicks: 500, conversions: 12, results: 12,
    },
  });
  await prisma.campaignDailyMetric.create({
    data: { campaignId: campaign.id, date: new Date("2026-09-30T00:00:00.000Z"), spend: 9999, conversions: 99 },
  });
  await prisma.projectKpi.create({
    data: { projectId, position: 0, metric: "CONVERSIONS", target: 31, updatedAt: new Date() },
  });
  await grantAccess(boris.membership!.id, clientId);
  await link(anna.membership!.id, ANNA);
  await link(boris.membership!.id, BORIS);
});

afterAll(() => prisma.$disconnect());

describe("a summary read from the app's figures", () => {
  it("shows the project's figures for the month and its KPI against the prorated target", async () => {
    const outcome = await summaries.project(ANNA, projectId, "m", 0);
    if (outcome.kind !== "ready") throw new Error(outcome.kind);

    expect(outcome.value.project).toMatchObject({ name: "Евроопт", clientName: "Евроопт", currency: "RUB" });
    expect(outcome.value.performance).toMatchObject({ spend: 1000, clicks: 500, conversions: 12 });
    expect(outcome.value.kpis).toHaveLength(1);
    expect(outcome.value.kpis[0]!.reading.actual).toBe(12);
    expect(outcome.value.kpis[0]!.reading.target).toBeCloseTo(20);
    expect(outcome.value.kpis[0]!.standing).toBe("danger");
  });

  it("counts the dashboard over every reachable project", async () => {
    const outcome = await summaries.dashboard(ANNA, "m");
    if (outcome.kind !== "ready") throw new Error(outcome.kind);

    expect(outcome.value.currencies.reduce((sum, group) => sum + group.performance.spend, 0)).toBe(1000);
    expect(outcome.value.standings).toEqual({ met: 0, behind: 0, danger: 1, none: 1 });
    expect(outcome.value.lagging).toEqual([{ name: "Евроопт", percent: 60, standing: "danger" }]);
  });

  it("keeps a manager to the clients they reach", async () => {
    const list = await summaries.projects(BORIS, 0);
    if (list.kind !== "ready") throw new Error(list.kind);

    expect(list.value.projects.map((each) => each.name)).toEqual(["Евроопт"]);
    expect(await summaries.project(BORIS, otherProjectId, "m", 0)).toEqual({ kind: "gone" });
  });
});
