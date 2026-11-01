import { useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { EditorToolbarButton, RICH_TEXT_CLASS, Separator, followLink } from "@/shared/ui/index.js";
import { WarmTooltipGroup } from "@/shared/ui/WarmTooltip/WarmTooltip.js";

export interface DocumentEditorProps {
  value: unknown | null;
  editable: boolean;
  onChange: (value: unknown) => void;
}

const HEADINGS = [
  { level: 1, label: "editor.heading1", icon: Heading1 },
  { level: 2, label: "editor.heading2", icon: Heading2 },
  { level: 3, label: "editor.heading3", icon: Heading3 },
] as const;

function DocumentToolbar({ editor }: { editor: Editor }) {
  return (
    <WarmTooltipGroup>
      <div className="flex flex-wrap items-center gap-1 border-b p-1" data-testid="document-toolbar">
        <EditorToolbarButton
          label={t("tasks.editor.undo")}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </EditorToolbarButton>
        <EditorToolbarButton
          label={t("tasks.editor.redo")}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </EditorToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {HEADINGS.map(({ level, label, icon: Icon }) => (
          <EditorToolbarButton
            key={level}
            label={t(label)}
            active={editor.isActive("heading", { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            <Icon />
          </EditorToolbarButton>
        ))}
        <EditorToolbarButton
          label={t("editor.paragraph")}
          active={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow />
        </EditorToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-4" />

        <EditorToolbarButton
          label={t("tasks.editor.bold")}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </EditorToolbarButton>
        <EditorToolbarButton
          label={t("tasks.editor.italic")}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </EditorToolbarButton>
        <EditorToolbarButton
          label={t("tasks.editor.strike")}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </EditorToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-4" />

        <EditorToolbarButton
          label={t("tasks.editor.bulletList")}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </EditorToolbarButton>
        <EditorToolbarButton
          label={t("tasks.editor.orderedList")}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </EditorToolbarButton>
        <EditorToolbarButton
          label={t("tasks.editor.blockquote")}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </EditorToolbarButton>
      </div>
    </WarmTooltipGroup>
  );
}

export function DocumentEditor({ value, editable, onChange }: DocumentEditorProps) {
  const [initialContent] = useState(value);
  const report = useRef(onChange);
  report.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-4",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    editable,
    content: (initialContent as never) ?? "",
    onUpdate: ({ editor: instance }) => report.current(instance.getJSON()),
    editorProps: {
      attributes: {
        "aria-label": t("documents.text"),
        class: cn(RICH_TEXT_CLASS, "min-h-64"),
      },
    },
  });

  return (
    <div
      className="rounded-md border"
      onClick={(event) => {
        if (followLink(event)) return;
        if (editable) editor?.commands.focus();
      }}
    >
      {editable && editor ? <DocumentToolbar editor={editor} /> : null}
      <EditorContent editor={editor} data-testid="document-editor" />
    </div>
  );
}
