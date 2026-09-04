import { useState } from "react";
import { Button } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import {
  AvatarEditorDialog,
  AvatarPreview,
  randomAvatarOptions,
  type AvatarOptions,
} from "@/features/avatar-editor/index.js";

export interface ChosenAvatar {
  options: AvatarOptions | null;
  file: File | null;
  preview: string | null;
}

export const NO_AVATAR: ChosenAvatar = { options: null, file: null, preview: null };

export function AvatarStep({
  value, onChange,
}: { value: ChosenAvatar; onChange: (next: ChosenAvatar) => void }) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center gap-4">
      <div className="size-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
        {value.preview != null ? (
          <img src={value.preview} alt="" className="size-full object-cover" />
        ) : value.options != null ? (
          <AvatarPreview options={value.options} />
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          {t("registration.avatar.create")}
        </Button>

        <label className="text-sm text-muted-foreground">
          <span className="cursor-pointer underline">{t("registration.avatar.upload")}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={t("registration.avatar.upload")}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!file.type.startsWith("image/")) {
                setUploadError(t("registration.avatar.wrongType"));
                return;
              }
              setUploadError(null);
              onChange({ options: null, file, preview: URL.createObjectURL(file) });
            }}
          />
        </label>
        {uploadError != null && (
          <p role="alert" className="text-xs text-destructive">{uploadError}</p>
        )}
      </div>

      <AvatarEditorDialog
        open={editing}
        initial={value.options ?? randomAvatarOptions()}
        onClose={() => setEditing(false)}
        onSave={async (options) => {
          onChange({ options, file: null, preview: null });
          setEditing(false);
        }}
      />
    </div>
  );
}
