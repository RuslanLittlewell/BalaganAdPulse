export const MAX_LEAD_FILE_BYTES = 20 * 1024 * 1024;
export const LEAD_FILE_NAME_LIMIT = 255;

export interface LeadFileRecord {
  id: string;
  leadId: string;
  name: string;
  contentType: string;
  bytes: number;
  uploader: { id: string; name: string } | null;
  createdAt: Date;
}

export interface StoredLeadFile extends LeadFileRecord {
  storageKey: string;
}

const MEDIA_TYPE = /^[\w.+-]+\/[\w.+-]+$/;

export function safeContentType(declared: string | undefined): string {
  return declared && MEDIA_TYPE.test(declared) && declared.length <= 255 ? declared : 'application/octet-stream';
}

export function fileNameOf(name: string): string {
  const trimmed = name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim();
  return (trimmed || 'file').slice(0, LEAD_FILE_NAME_LIMIT);
}
