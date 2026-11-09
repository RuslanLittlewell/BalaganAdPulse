import { useState } from "react";
import { Check, Pencil, SendHorizontal, Trash2, X } from "lucide-react";
import {
  MAX_LEAD_NOTE_LENGTH,
  useAddLeadNote,
  useEditLeadNote,
  useLeadNotes,
  useRemoveLeadNote,
  type LeadNote,
} from "@/entities/lead/index.js";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError, formatDateTime } from "@/shared/lib/index.js";
import { Avatar, Button, Loader, useAlerts } from "@/shared/ui/index.js";

export interface LeadNotesTabProps {
  boardKey: string;
  leadId: string;
  editable: boolean;
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.status < 500 ? error.message : fallback;

export function LeadNotesTab({ boardKey, leadId, editable }: LeadNotesTabProps) {
  const { data: notes, isPending, isError } = useLeadNotes(boardKey, leadId);
  const add = useAddLeadNote(boardKey, leadId);
  const edit = useEditLeadNote(boardKey, leadId);
  const remove = useRemoveLeadNote(boardKey, leadId);
  const { membershipId, role } = useAuth();
  const { raise } = useAlerts();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<LeadNote | null>(null);
  const busy = add.isPending || edit.isPending;

  const mayEdit = (note: LeadNote) => editable && note.author?.id === membershipId;
  const mayDelete = (note: LeadNote) => note.author?.id === membershipId || role === "ADMIN";

  function clear() {
    setText("");
    setEditing(null);
  }

  function submit() {
    const body = text.trim();
    if (body === "" || busy) return;
    const failed = (error: unknown) => raise(messageOf(error, t("crm.notes.failed")));
    if (editing) edit.mutate({ id: editing.id, body }, { onSuccess: clear, onError: failed });
    else add.mutate(body, { onSuccess: clear, onError: failed });
  }

  return (
    <div className="flex flex-col gap-3">
      {isPending ? <Loader /> : null}
      {isError ? <p role="alert" className="text-sm text-destructive">{t("crm.notes.loadFailed")}</p> : null}
      {notes && notes.length === 0 ? <p className="text-sm text-muted-foreground">{t("crm.notes.empty")}</p> : null}

      {notes && notes.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} data-editing={editing?.id === note.id ? "true" : undefined} className="group flex gap-2 rounded-lg px-2 py-1">
              <Avatar name={note.author?.name ?? t("crm.notes.unknownAuthor")} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{note.author?.name ?? t("crm.notes.unknownAuthor")}</span>
                  <time dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
                  {note.editedAt ? <span title={formatDateTime(note.editedAt)}>{t("crm.notes.edited")}</span> : null}
                  <span className="ml-auto flex items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                    {mayEdit(note) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-5"
                        aria-label={t("crm.notes.edit")}
                        disabled={busy}
                        onClick={() => { setEditing(note); setText(note.body); }}
                      >
                        <Pencil aria-hidden className="size-3" />
                      </Button>
                    ) : null}
                    {mayDelete(note) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-5"
                        aria-label={t("crm.notes.delete")}
                        disabled={remove.isPending}
                        onClick={() => {
                          if (editing?.id === note.id) clear();
                          remove.mutate(note.id, { onError: (error) => raise(messageOf(error, t("crm.notes.deleteFailed"))) });
                        }}
                      >
                        <Trash2 aria-hidden className="size-3" />
                      </Button>
                    ) : null}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {editable ? (
        <div className="flex flex-col gap-1">
          {editing ? (
            <div className="flex items-center gap-2 rounded-md border-l-2 border-primary bg-primary/5 py-1 pl-2 pr-1">
              <Pencil aria-hidden className="size-3 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-primary">{t("crm.notes.editing")}</div>
                <div className="truncate text-xs text-muted-foreground">{editing.body}</div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" aria-label={t("crm.notes.cancelEdit")} onClick={clear}>
                <X aria-hidden className="size-3" />
              </Button>
            </div>
          ) : null}
          <div className="flex items-end gap-2 rounded-2xl border border-input py-1 pl-3 pr-1 transition-colors focus-within:border-ring">
            <textarea
              aria-label={t("crm.notes.field")}
              placeholder={t("crm.notes.placeholder")}
              value={text}
              rows={2}
              maxLength={MAX_LEAD_NOTE_LENGTH}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
              className="min-h-10 flex-1 resize-none bg-transparent py-1 text-sm leading-4 outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="button"
              size="icon"
              className="size-6 shrink-0 rounded-full"
              aria-label={editing ? t("crm.notes.save") : t("crm.notes.send")}
              disabled={text.trim() === "" || busy}
              onClick={submit}
            >
              {editing ? <Check aria-hidden className="size-3" /> : <SendHorizontal aria-hidden className="size-3" />}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
