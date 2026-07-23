/** Formats a stored date to the bare `YYYY-MM-DD` form used across the API. */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
