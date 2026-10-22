import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button, Label, Loader, useAlerts } from "@/shared/ui/index.js";
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

export function TaskComments({ task }: TaskCommentsProps) {
  const { data: comments, isLoading, isError } = useTaskComments(task.id);
  const { data: members } = useMembers();
  const { user } = useAuth();
  const add = useAddTaskComment(task.id);
  const remove = useDeleteTaskComment(task.id);
  const { raise } = useAlerts();

  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [chosen, setChosen] = useState<MentionedMember[]>([]);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const placeCaret = useRef<number | null>(null);

  useEffect(() => {
    if (placeCaret.current === null) return;
    field.current?.focus();
    field.current?.setSelectionRange(placeCaret.current, placeCaret.current);
    placeCaret.current = null;
  }, [text]);

  const own = (members ?? []).find((member) => member.userId === user?.id && member.status === "ACTIVE");
  const byId = useMemo(() => new Map((members ?? []).map((member) => [member.id, member])), [members]);
  const taggable = useMemo(
    () => taggableMembers(task, members ?? [], own?.id),
    [task, members, own?.id],
  );

  const query = dismissed ? null : mentionQueryAt(text, caret);
  const offered = query ? matchingMembers(taggable, query.text) : [];
  const choosing = query !== null && offered.length > 0;

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

  const send = () => {
    const body = text.trim();
    if (body === "" || add.isPending) return;
    add.mutate(
      { body, mentionIds: tagsStillIn(body, chosen) },
      {
        onSuccess: () => {
          setText("");
          setCaret(0);
          setChosen([]);
        },
        onError: () => raise(t("comments.sendFailed")),
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      send();
    }
  };

  const mayDelete = (comment: TaskComment) =>
    own !== undefined && (comment.authorId === own.id || own.role === "ADMIN");

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
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => {
            const author = comment.authorId ? byId.get(comment.authorId) : undefined;
            const tagged = comment.mentionIds.flatMap((id) => {
              const member = byId.get(id);
              return member ? [member.name] : [];
            });
            return (
              <li key={comment.id} className="group flex gap-3">
                {author ? <MemberAvatar member={author} size="sm" /> : <span className="size-8 shrink-0 rounded-md bg-muted" />}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{author?.name ?? t("comments.unknownAuthor")}</span>
                    <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
                    {mayDelete(comment) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-6 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={t("comments.delete")}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(comment.id, { onError: () => raise(t("comments.deleteFailed")) })}
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </Button>
                    ) : null}
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

      <div className="relative flex flex-col gap-2">
        <textarea
          ref={field}
          aria-label={t("comments.field")}
          placeholder={t("comments.placeholder")}
          value={text}
          rows={3}
          onChange={track}
          onKeyDown={onKeyDown}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onBlur={() => setDismissed(true)}
          className="min-h-20 rounded-md border border-input bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
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
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={text.trim() === "" || add.isPending} onClick={send}>
            {t("comments.send")}
          </Button>
        </div>
      </div>
    </section>
  );
}
