import type { Lead } from "../api/api.js";

export function arrivalIso(lead: Pick<Lead, "createdAt" | "metaSource">): string {
  return lead.metaSource?.submittedAt ?? lead.createdAt;
}

export function arrivalDay(lead: Pick<Lead, "createdAt" | "metaSource">): string {
  return arrivalIso(lead).slice(0, 10);
}
