export function registrationLink(registrationUrl: string): string {
  return `${window.location.origin}${registrationUrl}`;
}
