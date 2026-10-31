import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  END,
  START,
  areasOf,
  describePullRequest,
  mergeBody,
  proposalPaths,
  sectionOf,
} from "./pr-description.mjs";

const proposal = [
  "## Why",
  "",
  "Clients could not find their reports.",
  "",
  "## What Changes",
  "",
  "- Reports show as files.",
  "",
  "## Capabilities",
  "",
  "### Modified Capabilities",
].join("\n");

describe("finding the OpenSpec changes of a pull request", () => {
  it("names active and archived changes by their proposal, ignoring every other file", () => {
    assert.deepEqual(proposalPaths([
      "openspec/changes/client-login-domain/proposal.md",
      "openspec/changes/archive/2026-10-28-client-report-files/proposal.md",
      "openspec/changes/archive/2026-10-28-client-report-files/design.md",
      "openspec/specs/monthly-reports/spec.md",
      "apps/web/src/pages/reports/ReportsPage.tsx",
    ]), [
      { name: "client-login-domain", path: "openspec/changes/client-login-domain/proposal.md" },
      { name: "client-report-files", path: "openspec/changes/archive/2026-10-28-client-report-files/proposal.md" },
    ]);
  });

  it("shows a change both active and archived once, as archived", () => {
    assert.deepEqual(proposalPaths([
      "openspec/changes/archive/2026-10-28-pr-description/proposal.md",
      "openspec/changes/pr-description/proposal.md",
    ]), [{ name: "pr-description", path: "openspec/changes/archive/2026-10-28-pr-description/proposal.md" }]);
  });
});

describe("reading a proposal", () => {
  it("takes a section up to the next heading of its level", () => {
    assert.equal(sectionOf(proposal, "Why"), "Clients could not find their reports.");
    assert.equal(sectionOf(proposal, "What Changes"), "- Reports show as files.");
  });

  it("answers null for a section that is missing or empty", () => {
    assert.equal(sectionOf(proposal, "Impact"), null);
    assert.equal(sectionOf("## Why\n\n## What Changes\n\n- x", "Why"), null);
  });
});

describe("naming the parts a pull request touches", () => {
  it("names modules, slices and the rest once each, in order", () => {
    assert.deepEqual(areasOf([
      "apps/web/src/pages/reports/ReportsPage.tsx",
      "apps/api/src/modules/reports/application/report-use-cases.ts",
      "apps/api/src/modules/reports/domain/report.ts",
      "apps/api/prisma/migrations/20261028190000_client_login_domain/migration.sql",
      "apps/web/src/app/App.tsx",
      "packages/access-policy/src/index.ts",
      ".github/workflows/ci.yml",
      "README.md",
      "docs/meta-integration.md",
      "package.json",
    ]), [
      "API · database",
      "API · reports",
      "CI",
      "Docs",
      "Package · access-policy",
      "Repository",
      "Web",
      "Web · pages/reports",
    ]);
  });
});

describe("describing a pull request", () => {
  it("gives each change its why and what, then the parts touched and the commits", () => {
    const text = describePullRequest({
      files: ["apps/web/src/pages/reports/ReportsPage.tsx"],
      commits: ["feat(reports): show reports as files", "fix(ci): send the login body"],
      changes: [{ name: "client-report-files", proposal }],
    });

    assert.equal(text, [
      "## Why",
      "### client-report-files\n\nClients could not find their reports.\n\n**What changes**\n\n- Reports show as files.",
      "## Touches",
      "- Web · pages/reports",
      "## Commits",
      "- feat(reports): show reports as files\n- fix(ci): send the login body",
    ].join("\n\n"));
  });

  it("drops what changes, then everything but the names, to stay within the limit", () => {
    const pullRequest = { files: [], commits: [], changes: [{ name: "client-report-files", proposal }] };
    const full = describePullRequest(pullRequest);
    const whyOnly = describePullRequest(pullRequest, full.length - 1);
    const namesOnly = describePullRequest(pullRequest, whyOnly.length - 1);

    assert.match(full, /What changes/);
    assert.doesNotMatch(whyOnly, /What changes/);
    assert.match(whyOnly, /Clients could not find their reports\./);
    assert.match(namesOnly, /^## Why\n\n- client-report-files\n\n## Touches/);
  });

  it("says so when no OpenSpec change is in it", () => {
    const text = describePullRequest({ files: ["README.md"], commits: ["docs: fix a typo"], changes: [] });

    assert.match(text, /^## Why\n\nNo OpenSpec change in this pull request\.\n\n## Touches\n\n- Docs\n/);
  });
});

describe("merging the description into a pull request's body", () => {
  const generated = "## Why\n\nBecause.";
  const block = `${START}\n${generated}\n${END}`;

  it("fills an empty body", () => {
    assert.equal(mergeBody(null, generated), block);
    assert.equal(mergeBody("  \n", generated), block);
  });

  it("puts the description above what the author wrote", () => {
    assert.equal(mergeBody("Please check the PDF too.", generated), `${block}\n\nPlease check the PDF too.`);
  });

  it("replaces an earlier description and keeps the author's text around it", () => {
    const current = `Intro\n\n${START}\n## Why\n\nOld.\n${END}\n\nOutro`;

    assert.equal(mergeBody(current, generated), `Intro\n\n${block}\n\nOutro`);
  });

  it("changes nothing on a second run with the same description", () => {
    const once = mergeBody("Notes", generated);

    assert.equal(mergeBody(once, generated), once);
  });
});
