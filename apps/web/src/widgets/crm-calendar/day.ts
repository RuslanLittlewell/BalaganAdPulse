import { arrivalDay, arrivalIso, type Lead } from "@/entities/lead/index.js";

export function leadsOfDay(leads: readonly Lead[], day: string): Lead[] {
  return leads
    .filter((lead) => arrivalDay(lead) === day)
    .sort((a, b) => arrivalIso(a).localeCompare(arrivalIso(b)));
}
