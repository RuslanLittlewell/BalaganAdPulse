/**
 * The whole address a person can be sent.
 *
 * The backend returns `registrationUrl` as a relative path on purpose, so it
 * needs no host configuration and cannot be wrong in one environment; this is
 * where it becomes something pasteable, from wherever the app is being served.
 */
export function registrationLink(registrationUrl: string): string {
  return `${window.location.origin}${registrationUrl}`;
}
