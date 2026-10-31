import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const START = "<!-- pr-description:start -->";
export const END = "<!-- pr-description:end -->";
export const BODY_LIMIT = 60_000;

const PROPOSAL = /^openspec\/changes\/(?:archive\/\d{4}-\d{2}-\d{2}-)?([^/]+)\/proposal\.md$/;

const AREAS = [
  [/^apps\/api\/prisma\//, () => "API · database"],
  [/^apps\/api\/src\/modules\/([^/]+)\//, ([, module]) => `API · ${module}`],
  [/^apps\/api\/test\//, () => "API · tests"],
  [/^apps\/api\//, () => "API"],
  [/^apps\/web\/src\/([^/]+)\/([^/.]+)\//, ([, layer, slice]) => `Web · ${layer}/${slice}`],
  [/^apps\/web\/test\//, () => "Web · tests"],
  [/^apps\/web\//, () => "Web"],
  [/^apps\/landing\//, () => "Landing"],
  [/^packages\/([^/]+)\//, ([, name]) => `Package · ${name}`],
  [/^\.github\//, () => "CI"],
  [/^openspec\//, () => "OpenSpec"],
  [/^(?:docs\/|[^/]+\.md$)/, () => "Docs"],
  [/^/, () => "Repository"],
];

export function proposalPaths(files) {
  const byName = new Map();
  for (const file of files) {
    const match = PROPOSAL.exec(file);
    if (!match) continue;
    const name = match[1];
    if (!byName.has(name) || file.includes("/archive/")) byName.set(name, file);
  }
  return [...byName.entries()].map(([name, path]) => ({ name, path }));
}

export function sectionOf(markdown, heading) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  const text = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return text === "" ? null : text;
}

export function areasOf(files) {
  const areas = [];
  for (const file of files) {
    for (const [pattern, name] of AREAS) {
      const match = pattern.exec(file);
      if (!match) continue;
      const area = name(match);
      if (!areas.includes(area)) areas.push(area);
      break;
    }
  }
  return areas.sort((left, right) => left.localeCompare(right));
}

const DETAILS = ["full", "why", "names"];

function changeSection({ name, proposal }, detail) {
  if (detail === "names") return `- ${name}`;
  const why = sectionOf(proposal, "Why");
  const what = detail === "full" ? sectionOf(proposal, "What Changes") : null;
  return [`### ${name}`, why, what && `**What changes**\n\n${what}`].filter(Boolean).join("\n\n");
}

function described({ files, commits, changes }, detail) {
  const why = changes.length === 0
    ? "No OpenSpec change in this pull request."
    : changes.map((change) => changeSection(change, detail)).join(detail === "names" ? "\n" : "\n\n");
  const touches = areasOf(files).map((area) => `- ${area}`).join("\n");
  const log = (detail === "names" ? commits.slice(-100) : commits).map((subject) => `- ${subject}`).join("\n");
  return [
    "## Why",
    why,
    "## Touches",
    touches || "Nothing.",
    "## Commits",
    log || "None.",
  ].join("\n\n");
}

export function describePullRequest(pullRequest, limit = BODY_LIMIT) {
  for (const detail of DETAILS) {
    const text = described(pullRequest, detail);
    if (text.length <= limit || detail === "names") return text;
  }
}

export function mergeBody(current, generated) {
  const block = `${START}\n${generated.trim()}\n${END}`;
  const text = current ?? "";
  const start = text.indexOf(START);
  const end = start === -1 ? -1 : text.indexOf(END, start);
  if (end !== -1) return text.slice(0, start) + block + text.slice(end + END.length);
  return text.trim() === "" ? block : `${block}\n\n${text.trim()}`;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const linesOf = (output) => output.split("\n").filter((line) => line.trim() !== "");

export function describeRange(base, head) {
  const files = linesOf(git("diff", "--name-only", "--diff-filter=AMR", `${base}...${head}`));
  const commits = linesOf(git("log", "--no-merges", "--reverse", "--format=%s", `${base}..${head}`));
  const changes = proposalPaths(files).map(({ name, path }) => ({ name, proposal: git("show", `${head}:${path}`) }));
  return describePullRequest({ files, commits, changes });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) {
    process.stderr.write("Usage: node scripts/pr-description.mjs <base> <head>\n");
    process.exit(2);
  }
  process.stdout.write(`${describeRange(base, head)}\n`);
}
