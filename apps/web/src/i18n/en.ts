export const en = {
  "brand.title": "AdPulse",
  "clients.section": "Clients",
  "clients.new": "New client",
  "clients.empty.title": "Select a client",
  "clients.empty.description": "Or add a new one from the sidebar",
  "clients.notFound.title": "Client not found",
  "clients.notFound.description": "It may have been deleted",
  "client.edit": "Edit",
  "client.delete": "Delete",
  "client.delete.title": "Delete client?",
  "client.delete.body": "This permanently deletes the client and its campaigns.",
  "form.new.title": "New client",
  "form.edit.title": "Edit client",
  "form.name.label": "Name",
  "form.niche.label": "Niche",
  "form.budget.label": "Budget $/mo",
  "form.email.label": "Client email",
  "form.email.invalid": "Enter a valid email address",
  "action.cancel": "Cancel",
  "action.create": "Create",
  "action.save": "Save",
  "action.delete": "Delete",
  "state.error.title": "Something went wrong",
  "state.retry": "Retry",
} as const;

export type MessageKey = keyof typeof en;

export function t(key: MessageKey): string {
  return en[key];
}
