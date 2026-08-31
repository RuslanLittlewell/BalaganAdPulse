import { useMemo, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { ClientAvatar, useSaveClientAvatar, type Client } from "@/entities/client/index.js";
import { AvatarEditorDialog, parseAvatarPath, type AvatarOptions } from "@/features/avatar-editor/index.js";
import { t } from "@/shared/config/index.js";
import { toSquarePng } from "@/shared/lib/index.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/index.js";

/** Marks a picture the client supplied, as opposed to one the editor made. */
const UPLOADED = JSON.stringify({ source: "upload" });

export interface ContactAvatarProps {
  client: Client;
}

/**
 * The client's picture, and the two ways to change it. The pencil only appears
 * over the image on hover or keyboard focus, so the picture stays the subject
 * and the control stays discoverable.
 */
export function ContactAvatar({ client }: ContactAvatarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveClientAvatar();

  // An uploaded logo has no generator settings, so the editor opens on a random
  // face rather than on nothing.
  const initial = useMemo(() => parseAvatarPath(client.avatarPath), [client.avatarPath]);

  async function upload(file: File) {
    setError(null);
    try {
      const png = await toSquarePng(file);
      await save.mutateAsync({ id: client.id, png, avatarPath: UPLOADED });
    } catch {
      setError(t("contacts.avatar.failed"));
    }
  }

  async function saveGenerated(options: AvatarOptions, png: Blob) {
    setError(null);
    try {
      await save.mutateAsync({ id: client.id, png, avatarPath: JSON.stringify(options) });
      setEditorOpen(false);
    } catch {
      setError(t("contacts.avatar.failed"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group relative shrink-0 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label={t("contacts.avatar.change")}
          >
            <ClientAvatar client={client} size="lg" />
            <span className="absolute inset-0 grid place-items-center rounded-md bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100">
              <PencilIcon className="size-4 text-white" aria-hidden="true" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            {t("contacts.avatar.upload")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditorOpen(true)}>
            {t("contacts.avatar.generate")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={t("contacts.avatar.upload")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset first: picking the same file twice must fire onChange again.
          event.target.value = "";
          if (file) void upload(file);
        }}
      />

      {error != null && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <AvatarEditorDialog
        open={editorOpen}
        initial={initial}
        onClose={() => setEditorOpen(false)}
        onSave={saveGenerated}
      />
    </>
  );
}
