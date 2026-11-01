import type React from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor, type FocusPosition } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react";
import { TaskImage } from "./TaskImageNode.js";
import { imageRefusal, taskImagesApi } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError, cn } from "@/shared/lib/index.js";
import { EditorToolbarButton, RICH_TEXT_CLASS, Separator, followLink } from "@/shared/ui/index.js";
import { WarmTooltipGroup } from "@/shared/ui/WarmTooltip/WarmTooltip.js";

export interface TaskDescriptionEditorProps {
  className?: string;
  value: unknown | null;
  onChange: (value: unknown) => void;
  editable?: boolean;
  onEdit?: () => void;
}

export interface TaskDescriptionEditorHandle {
  removeImage(imageId: string): void;
  appendImage(imageId: string): void;
}

function EditorToolbar({ editor }: { editor: Editor }) {
  return (
    <WarmTooltipGroup>
      <div
        className="flex flex-wrap items-center gap-1 border-b p-1"
        data-testid="task-description-toolbar"
      >
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

        <Separator orientation="vertical" className="mx-1 h-4" />

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
      </div>
    </WarmTooltipGroup>
  );
}

export const TaskDescriptionEditor = forwardRef<
  TaskDescriptionEditorHandle,
  TaskDescriptionEditorProps
>(function TaskDescriptionEditor(
  { value, onChange, editable = true, onEdit, className },
  ref,
) {
  const [status, setStatus] = useState<string | null>(null);
  const [initialContent] = useState(value);

  const report = useRef(onChange);
  report.current = onChange;
  const mayEdit = useRef(editable);
  mayEdit.current = editable;
  const caret = useRef<FocusPosition>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskImage,
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
        "aria-label": t("tasks.form.description"),
        class: RICH_TEXT_CLASS,
      },
      handlePaste: (_view, event) =>
        mayEdit.current ? insertFrom(event.clipboardData?.files) : false,
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable, false);
    if (editable && caret.current !== null) editor.commands.focus(caret.current);
    caret.current = null;
  }, [editor, editable]);

  useImperativeHandle(
    ref,
    () => ({
      removeImage(imageId: string) {
        if (!editor) return;
        const positions: number[] = [];
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "taskImage" && node.attrs.imageId === imageId)
            positions.push(pos);
          return true;
        });
        if (positions.length === 0) return;
        const transaction = editor.state.tr;
        for (const pos of positions.reverse()) {
          transaction.delete(
            transaction.mapping.map(pos),
            transaction.mapping.map(pos + 1),
          );
        }
        editor.view.dispatch(transaction);
      },
      appendImage(imageId: string) {
        if (!editor) return;
        const image = { type: "taskImage", attrs: { imageId } };
        const { doc } = editor.state;
        const last = doc.lastChild;
        if (last?.type.name === "paragraph" && last.content.size === 0)
          editor.commands.insertContentAt(doc.content.size - 1, image);
        else
          editor.commands.insertContentAt(doc.content.size, { type: "paragraph", content: [image] });
      },
    }),
    [editor],
  );

  function insertFrom(files: FileList | undefined | null): boolean {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return false;

    void upload(file);
    return true;
  }

  async function upload(file: Blob & { type: string }) {
    const refusal = imageRefusal(file);
    if (refusal) {
      setStatus(t(`tasks.editor.${refusal}`));
      return;
    }

    setStatus(t("tasks.editor.uploading"));
    try {
      const image = await taskImagesApi.upload(file);
      editor
        ?.chain()
        .focus()
        .insertContent({ type: "taskImage", attrs: { imageId: image.id } })
        .run();
      setStatus(null);
    } catch (error) {
      setStatus(
        error instanceof ApiError
          ? error.message
          : t("tasks.editor.uploadFailed"),
      );
    }
  }

  function editAt(event: React.MouseEvent<HTMLDivElement>) {
    if (!editor || !onEdit) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !event.currentTarget.contains(target) || target.closest("button")) return;
    if (window.getSelection()?.isCollapsed === false) return;
    caret.current = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? "end";
    onEdit();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!editable) return;
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    insertFrom(event.dataTransfer.files);
  }

  return (
    <div
      className={cn("rounded-md border", !editable && onEdit && "cursor-text", className)}
      onClick={(event) => {
        if (followLink(event)) return;
        if (editable) editor?.commands.focus();
        else editAt(event);
      }}
      onDrop={handleDrop}
      onDragOver={(event) => {
        if (event.dataTransfer?.types?.includes("Files"))
          event.preventDefault();
      }}
    >
      {editable && editor ? <EditorToolbar editor={editor} /> : null}
      <EditorContent editor={editor} data-testid="task-description-editor" />
      {status ? (
        <p role="status" className="border-t p-2 text-xs text-muted-foreground">
          {status}
        </p>
      ) : null}
    </div>
  );
});
