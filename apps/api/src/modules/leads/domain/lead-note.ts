export const MAX_LEAD_NOTE_LENGTH = 5000;

export interface LeadNoteRecord {
  id: string;
  leadId: string;
  author: { id: string; name: string } | null;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
}
