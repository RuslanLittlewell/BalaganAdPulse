import type React from "react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
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
import { taskImagesApi } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError, cn } from "@/shared/lib/index.js";
import { Button, Separator } from "@/shared/ui/index.js";
import WarmTooltip, { WarmTooltipGroup } from "@/shared/ui/WarmTooltip/WarmTooltip.js";

export interface TaskDescriptionEditorProps {
  className?: string;
  value: unknown | null;
  onChange: (value: unknown) => void;
  editable?: boolean;
}

export interface TaskDescriptionEditorHandle {
  removeImage(imageId: string): void;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const EDITOR_CONTENT_CLASS = [
  "min-h-[400px] p-3 outline-none",
  "[&_p]:my-1",
  "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm",
  "[&_pre>code]:bg-transparent [&_pre>code]:p-0",
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold",
  "[&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold",
  "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_hr]:my-4 [&_hr]:border-border",
].join(" ");

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <WarmTooltip content={label} side="bottom" disabled={disabled}>
      <Button
        type="button"
        variant={active ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
    </WarmTooltip>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  return (
    <WarmTooltipGroup>
      <div
        className="flex flex-wrap items-center gap-1 border-b p-1"
        data-testid="task-description-toolbar"
      >
        <ToolbarButton
          label={t("tasks.editor.bold")}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label={t("tasks.editor.italic")}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label={t("tasks.editor.strike")}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarButton
          label={t("tasks.editor.bulletList")}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label={t("tasks.editor.orderedList")}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label={t("tasks.editor.blockquote")}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarButton
          label={t("tasks.editor.undo")}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton
          label={t("tasks.editor.redo")}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </ToolbarButton>
      </div>
    </WarmTooltipGroup>
  );
}

export const TaskDescriptionEditor = forwardRef<
  TaskDescriptionEditorHandle,
  TaskDescriptionEditorProps
>(function TaskDescriptionEditor(
  { value, onChange, editable = true, className },
  ref,
) {
  const [status, setStatus] = useState<string | null>(null);
  const [initialContent] = useState(value);

  const report = useRef(onChange);
  report.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskImage,
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: !editable,
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
        class: EDITOR_CONTENT_CLASS,
      },
      handlePaste: (_view, event) =>
        editable ? insertFrom(event.clipboardData?.files) : false,
    },
  });

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
    if (!ACCEPTED.includes(file.type)) {
      setStatus(t("tasks.editor.wrongType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus(t("tasks.editor.tooLarge"));
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

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!editable) return;
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    insertFrom(event.dataTransfer.files);
  }

  return (
    <div
      className={cn("rounded-md border", className)}
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
