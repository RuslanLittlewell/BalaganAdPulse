import type React from "react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskImage } from "./TaskImageNode.js";
import { taskImagesApi } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError, cn } from "@/shared/lib/index.js";

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

export const TaskDescriptionEditor = forwardRef<
  TaskDescriptionEditorHandle,
  TaskDescriptionEditorProps
>(function TaskDescriptionEditor({ value, onChange, editable = true, className }, ref) {
  const [status, setStatus] = useState<string | null>(null);
  const [initialContent] = useState(value);

  const report = useRef(onChange);
  report.current = onChange;

  const editor = useEditor({
    extensions: [StarterKit, TaskImage],
    editable,
    content: (initialContent as never) ?? "",
    onUpdate: ({ editor: instance }) => report.current(instance.getJSON()),
    editorProps: {
      attributes: {
        "aria-label": t("tasks.form.description"),
        class: "min-h-32 p-3 outline-none",
      },
      handlePaste: (_view, event) =>
        editable ? insertFrom(event.clipboardData?.files) : false,
    },
  });

  useImperativeHandle(ref, () => ({
    removeImage(imageId: string) {
      if (!editor) return;
      const positions: number[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "taskImage" && node.attrs.imageId === imageId) positions.push(pos);
        return true;
      });
      if (positions.length === 0) return;
      const transaction = editor.state.tr;
      for (const pos of positions.reverse()) {
        transaction.delete(transaction.mapping.map(pos), transaction.mapping.map(pos + 1));
      }
      editor.view.dispatch(transaction);
    },
  }), [editor]);

  function insertFrom(files: FileList | undefined | null): boolean {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return false;

    void upload(file);
    return true;
  }

  async function upload(file: Blob & { type: string }) {
    if (!ACCEPTED.includes(file.type)) { setStatus(t("tasks.editor.wrongType")); return; }
    if (file.size > MAX_BYTES) { setStatus(t("tasks.editor.tooLarge")); return; }

    setStatus(t("tasks.editor.uploading"));
    try {
      const image = await taskImagesApi.upload(file);
      editor?.chain().focus()
        .insertContent({ type: "taskImage", attrs: { imageId: image.id } })
        .run();
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof ApiError ? error.message : t("tasks.editor.uploadFailed"));
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
      onDragOver={(event) => { if (event.dataTransfer?.types?.includes("Files")) event.preventDefault(); }}
    >
      <EditorContent
        editor={editor}
        className="min-h-0 flex-1 overflow-y-auto"
        data-testid="task-description-editor"
      />
      {status ? <p role="status" className="border-t p-2 text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
});
