import { useId, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { Button } from "@/shared/ui/index.js";

const CONTENT_CLASS = [
  "outline-none text-sm leading-relaxed text-foreground",
  "[&_p]:my-1.5 [&_strong]:font-semibold",
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
].join(" ");

const isEmpty = (value: unknown) => {
  const content = (value as { content?: Array<{ content?: unknown[] }> } | null)?.content;
  return !content || content.every((node) => !node.content || node.content.length === 0);
};

function Toolbar({ editor }: { editor: Editor }) {
  const tools = [
    { label: t("tasks.editor.bold"), mark: "bold", icon: <Bold />, run: () => editor.chain().focus().toggleBold().run() },
    { label: t("tasks.editor.italic"), mark: "italic", icon: <Italic />, run: () => editor.chain().focus().toggleItalic().run() },
    { label: t("tasks.editor.bulletList"), mark: "bulletList", icon: <List />, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: t("tasks.editor.orderedList"), mark: "orderedList", icon: <ListOrdered />, run: () => editor.chain().focus().toggleOrderedList().run() },
  ];
  return (
    <div className="flex gap-1 border-b p-1">
      {tools.map((tool) => (
        <Button
          key={tool.mark}
          type="button"
          size="icon-sm"
          variant={editor.isActive(tool.mark) ? "secondary" : "ghost"}
          aria-label={tool.label}
          aria-pressed={editor.isActive(tool.mark)}
          onClick={tool.run}
        >
          {tool.icon}
        </Button>
      ))}
    </div>
  );
}

function Reader({ value }: { value: unknown }) {
  const editor = useEditor({
    extensions: [StarterKit],
    editable: false,
    content: value as never,
    editorProps: { attributes: { class: CONTENT_CLASS } },
  }, [value]);
  return <EditorContent editor={editor} />;
}

function Writer({
  title,
  value,
  pending,
  onSave,
  onCancel,
}: {
  title: string;
  value: unknown;
  pending: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<unknown>(value);
  const editor = useEditor({
    extensions: [StarterKit],
    content: (value as never) ?? "",
    onUpdate: ({ editor: instance }) => setDraft(instance.getJSON()),
    editorProps: { attributes: { "aria-label": title, class: `${CONTENT_CLASS} min-h-24 p-3` } },
  });
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border">
        {editor ? <Toolbar editor={editor} /> : null}
        <EditorContent editor={editor} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => onSave(isEmpty(draft) ? null : draft)}>{t("action.save")}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("action.cancel")}</Button>
      </div>
    </div>
  );
}

export function ReportText({
  title,
  value,
  editable,
  pending,
  onSave,
}: {
  title: string;
  value: unknown | null;
  editable: boolean;
  pending: boolean;
  onSave: (value: unknown | null, done: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-sm font-semibold text-foreground">{title}</h2>
        {editable && !editing ? (
          <Button size="sm" variant="ghost" aria-label={`${t("report.edit")}: ${title}`} onClick={() => setEditing(true)}>
            {t("report.edit")}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <Writer
          title={title}
          value={value}
          pending={pending}
          onCancel={() => setEditing(false)}
          onSave={(next) => onSave(next, () => setEditing(false))}
        />
      ) : value == null ? (
        <p className="text-sm text-muted-foreground">{t("report.text.empty")}</p>
      ) : (
        <Reader value={value} />
      )}
    </section>
  );
}
