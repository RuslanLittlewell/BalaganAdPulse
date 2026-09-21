import type { Lead } from "@/entities/lead/index.js";

function arrivalIso(lead: Lead): string {
  return lead.metaSource?.submittedAt ?? lead.createdAt;
}

function arrivalDay(lead: Lead): string {
  return arrivalIso(lead).slice(0, 10);
}

export function leadsOfDay(leads: readonly Lead[], day: string): Lead[] {
  return leads
    .filter((lead) => arrivalDay(lead) === day)
    .sort((a, b) => arrivalIso(a).localeCompare(arrivalIso(b)));
}
