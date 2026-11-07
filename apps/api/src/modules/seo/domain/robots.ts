export const CHECKER_AGENT = "AdPulseBot";

interface Rule {
  readonly allow: boolean;
  readonly pattern: string;
}

interface Group {
  readonly agents: string[];
  readonly rules: Rule[];
}

export interface RobotsRules {
  readonly groups: readonly Group[];
  readonly sitemaps: readonly string[];
}

export const ALLOW_ALL: RobotsRules = { groups: [], sitemaps: [] };

export function parseRobots(text: string): RobotsRules {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let collectingAgents = false;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (field === "user-agent") {
      if (!current || !collectingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      collectingAgents = true;
      continue;
    }
    if ((field === "allow" || field === "disallow") && current) {
      collectingAgents = false;
      if (value) current.rules.push({ allow: field === "allow", pattern: value });
    }
  }
  return { groups, sitemaps };
}

function escape(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const expression = body.split("*").map(escape).join(".*");
  return new RegExp(`^${expression}${anchored ? "$" : ""}`).test(path);
}

function rulesFor(rules: RobotsRules, agent: string): Rule[] {
  const name = agent.toLowerCase();
  const own = rules.groups.filter((group) => group.agents.some((candidate) => candidate !== "*" && name.startsWith(candidate)));
  const chosen = own.length > 0 ? own : rules.groups.filter((group) => group.agents.includes("*"));
  return chosen.flatMap((group) => group.rules);
}

export function isAllowed(rules: RobotsRules, address: string, agent = CHECKER_AGENT): boolean {
  const url = new URL(address);
  const path = `${url.pathname}${url.search}`;
  if (url.pathname === "/robots.txt") return true;
  let best: Rule | null = null;
  for (const rule of rulesFor(rules, agent)) {
    if (!matches(rule.pattern, path)) continue;
    const longer = !best || rule.pattern.length > best.pattern.length;
    const allowsTie = best !== null && rule.pattern.length === best.pattern.length && rule.allow;
    if (longer || allowsTie) best = rule;
  }
  return best?.allow ?? true;
}
