import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Check, Pencil, SendHorizontal, Trash2, X } from "lucide-react";
import { Avatar, Button, Label, Loader, useAlerts } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { cn, formatDateTime } from "@/shared/lib/index.js";
import {
  bodySegments,
  insertMention,
  matchingMembers,
  mentionQueryAt,
  taggableMembers,
  tagsStillIn,
  useAddTaskComment,
  useDeleteTaskComment,
  useEditTaskComment,
  useTaskComments,
  type MentionedMember,
  type Task,
  type TaskComment,
} from "@/entities/task/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import { useAuth } from "@/features/auth/index.js";

export interface TaskCommentsProps {
  task: Task;
}

const FIELD_MAX_HEIGHT = 160;

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((id) => right.includes(id));

export function TaskComments({ task }: TaskCommentsProps) {
  const { data: comments, isLoading, isError } = useTaskComments(task.id);
  const { data: members } = useMembers();
  const { membershipId, role } = useAuth();
  const add = useAddTaskComment(task.id);
  const change = useEditTaskComment(task.id);
  const remove = useDeleteTaskComment(task.id);
  const { raise } = useAlerts();

  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [chosen, setChosen] = useState<MentionedMember[]>([]);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [editing, setEditing] = useState<TaskComment | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const placeCaret = useRef<number | null>(null);

  useEffect(() => {
    if (placeCaret.current === null) return;
    field.current?.focus();
    field.current?.setSelectionRange(placeCaret.current, placeCaret.current);
    placeCaret.current = null;
  }, [text]);

  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, FIELD_MAX_HEIGHT)}px`;
  }, [text]);

  const byId = useMemo(() => new Map((members ?? []).map((member) => [member.id, member])), [members]);
  const taggable = useMemo(
    () => taggableMembers(task, members ?? [], membershipId ?? undefined),
    [task, members, membershipId],
  );

  const query = dismissed ? null : mentionQueryAt(text, caret);
  const offered = query ? matchingMembers(taggable, query.text) : [];
  const choosing = query !== null && offered.length > 0;
  const pending = add.isPending || change.isPending;

  const track = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    setCaret(event.target.selectionStart);
    setActive(0);
    setDismissed(false);
  };

  const choose = (member: { id: string; name: string }) => {
    if (!query) return;
    const next = insertMention(text, query, caret, member.name);
    setText(next.text);
    setCaret(next.caret);
    setChosen((current) => [...current.filter((entry) => entry.id !== member.id), { id: member.id, name: member.name }]);
    setActive(0);
    placeCaret.current = next.caret;
  };

  const clear = () => {
    setText("");
    setCaret(0);
    setChosen([]);
    setEditing(null);
  };

  const startEditing = (comment: TaskComment) => {
    setEditing(comment);
    setText(comment.body);
    setCaret(comment.body.length);
    setChosen(comment.mentionIds.flatMap((id) => {
      const member = byId.get(id);
      return member ? [{ id, name: member.name }] : [];
    }));
    setDismissed(true);
    placeCaret.current = comment.body.length;
  };

  const cancelEditing = () => {
    clear();
    field.current?.focus();
  };

  const submit = () => {
    const body = text.trim();
    if (body === "" || pending) return;
    const mentionIds = tagsStillIn(body, chosen);
    if (editing) {
      if (body === editing.body && sameIds(mentionIds, editing.mentionIds)) {
        clear();
        return;
      }
      change.mutate(
        { id: editing.id, body, mentionIds },
        { onSuccess: clear, onError: () => raise(t("comments.editFailed")) },
      );
      return;
    }
    add.mutate(
      { body, mentionIds },
      { onSuccess: clear, onError: () => raise(t("comments.sendFailed")) },
    );
  };

  const mayEdit = (comment: TaskComment) => membershipId !== null && comment.authorId === membershipId;

  const mayDelete = (comment: TaskComment) => mayEdit(comment) || role === "ADMIN";

  const lastOwn = () => [...(comments ?? [])].reverse().find(mayEdit);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (choosing) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((index) => (index + 1) % offered.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((index) => (index - 1 + offered.length) % offered.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        choose(offered[Math.min(active, offered.length - 1)]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setDismissed(true);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === "Escape" && editing) {
      event.preventDefault();
      event.stopPropagation();
      cancelEditing();
      return;
    }
    if (event.key === "ArrowUp" && text === "" && !editing) {
      const last = lastOwn();
      if (!last) return;
      event.preventDefault();
      startEditing(last);
    }
  };

  return (
    <section aria-labelledby={`task-comments-${task.id}`} className="flex flex-col gap-3">
      <Label id={`task-comments-${task.id}`}>
        {t("comments.title")}
        {comments && comments.length > 0 ? ` · ${comments.length}` : ""}
      </Label>

      {isLoading ? <Loader /> : null}
      {isError ? <p role="alert" className="text-sm text-destructive">{t("comments.loadFailed")}</p> : null}
      {comments && comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("comments.empty")}</p>
      ) : null}

      {comments && comments.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {comments.map((comment) => {
            const author = comment.authorId ? byId.get(comment.authorId) : undefined;
            const authorName = author?.name ?? comment.authorName;
            const tagged = comment.mentionIds.flatMap((id) => {
              const member = byId.get(id);
              return member ? [member.name] : [];
            });
            return (
              <li
                key={comment.id}
                data-editing={editing?.id === comment.id ? "true" : undefined}
                className={cn("group flex gap-3 rounded-lg px-2 py-1.5", editing?.id === comment.id && "bg-primary/10")}
              >
                {author ? (
                  <MemberAvatar member={author} size="sm" />
                ) : authorName ? (
                  <Avatar name={authorName} size="sm" />
                ) : (
                  <span className="size-8 shrink-0 rounded-md bg-muted" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{authorName ?? t("comments.unknownAuthor")}</span>
                    <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
                    {comment.editedAt ? (
                      <span title={formatDateTime(comment.editedAt)}>{t("comments.edited")}</span>
                    ) : null}
                    <span className="ml-auto flex items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                      {mayEdit(comment) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label={t("comments.edit")}
                          disabled={pending}
                          onClick={() => startEditing(comment)}
                        >
                          <Pencil aria-hidden className="size-3.5" />
                        </Button>
                      ) : null}
                      {mayDelete(comment) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label={t("comments.delete")}
                          disabled={remove.isPending}
                          onClick={() => {
                            if (editing?.id === comment.id) clear();
                            remove.mutate(comment.id, { onError: () => raise(t("comments.deleteFailed")) });
                          }}
                        >
                          <Trash2 aria-hidden className="size-3.5" />
                        </Button>
                      ) : null}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {bodySegments(comment.body, tagged).map((segment, index) => (
                      segment.tagged
                        ? <span key={index} data-tag className="rounded bg-primary/10 px-0.5 font-medium text-primary">{segment.text}</span>
                        : <span key={index}>{segment.text}</span>
                    ))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="relative flex flex-col gap-1.5">
        {editing ? (
          <div className="flex items-center gap-2 rounded-md border-l-2 border-primary bg-primary/5 py-1 pl-2 pr-1">
            <Pencil aria-hidden className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-primary">{t("comments.editing")}</div>
              <div className="truncate text-xs text-muted-foreground">{editing.body}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={t("comments.cancelEdit")}
              onClick={cancelEditing}
            >
              <X aria-hidden className="size-4" />
            </Button>
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-2xl border border-input py-1.5 pl-3.5 pr-1.5 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <textarea
            ref={field}
            aria-label={t("comments.field")}
            placeholder={t("comments.placeholder")}
            value={text}
            rows={1}
            onChange={track}
            onKeyDown={onKeyDown}
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
            onBlur={() => setDismissed(true)}
            className="min-h-8 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-sm leading-5 outline-none placeholder:text-muted-foreground"
            style={{ maxHeight: FIELD_MAX_HEIGHT }}
          />
          <Button
            type="button"
            size="icon"
            className="size-8 shrink-0 rounded-full"
            aria-label={editing ? t("comments.save") : t("comments.send")}
            disabled={text.trim() === "" || pending}
            onClick={submit}
          >
            {editing ? <Check aria-hidden className="size-4" /> : <SendHorizontal aria-hidden className="size-4" />}
          </Button>
        </div>
        {choosing ? (
          <ul
            role="listbox"
            aria-label={t("comments.mentions")}
            className="absolute bottom-full left-0 z-50 mb-1 max-h-48 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
          >
            {offered.map((member, index) => (
              <li
                key={member.id}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => { event.preventDefault(); choose(member); }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm",
                  index === active && "bg-accent",
                )}
              >
                <MemberAvatar member={member} size="sm" />
                <span className="truncate">{member.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
