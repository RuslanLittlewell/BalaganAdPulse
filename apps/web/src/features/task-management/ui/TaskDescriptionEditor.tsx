import type React from "react";
import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskImage } from "./TaskImageNode.js";
import { taskImagesApi } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";

export interface TaskDescriptionEditorProps {
  value: unknown | null;
  onChange: (value: unknown) => void;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * The description, with images pasted or dropped straight into it.
 *
 * An image is uploaded as it lands and the document keeps only its id — the
 * bytes never travel inside a task payload. Rendering fetches them with the
 * member's token and shows them from an object URL, because an `<img src>`
 * pointing at the API would carry no credentials.
 */
export function TaskDescriptionEditor({ value, onChange }: TaskDescriptionEditorProps) {
  const [status, setStatus] = useState<string | null>(null);
  const editor = useEditor({
    extensions: [StarterKit, TaskImage],
    content: (value as never) ?? "",
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON()),
    editorProps: {
      attributes: { "aria-label": t("tasks.form.description"), class: "min-h-32 p-3 outline-none" },
      handlePaste: (_view, event) => insertFrom(event.clipboardData?.files),
    },
  }, [value === null]);

  function insertFrom(files: FileList | undefined | null): boolean {
    const file = files?.[0];
    // Not an image: let ProseMirror handle it as it normally would, which is
    // what keeps pasted text pasting as text.
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
      // Only the id goes into the document; the node view fetches the bytes,
      // now and on every later open.
      editor?.chain().focus()
        .insertContent({ type: "taskImage", attrs: { imageId: image.id } })
        .run();
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof ApiError ? error.message : t("tasks.editor.uploadFailed"));
    }
  }

  /** Drop is handled here rather than through ProseMirror: the editor's own
   * hook needs a resolved drop position, and a file dropped anywhere on the
   * editor should land in the description wherever the cursor happens to be. */
  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    insertFrom(event.dataTransfer.files);
  }

  return (
    <div
      className="rounded-md border"
      onDrop={handleDrop}
      onDragOver={(event) => { if (event.dataTransfer?.types?.includes("Files")) event.preventDefault(); }}
    >
      <EditorContent editor={editor} data-testid="task-description-editor" />
      {status ? <p role="status" className="border-t p-2 text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
