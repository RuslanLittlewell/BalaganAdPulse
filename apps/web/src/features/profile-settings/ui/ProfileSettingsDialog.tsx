import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TextField,
} from "@/shared/ui/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { AvatarPreview, parseAvatarPath, randomAvatarOptions, type AvatarOptions } from "@/features/avatar-editor/index.js";
import { AvatarEditorDialog } from "@/features/avatar-editor/index.js";

interface Props { open: boolean; onClose: () => void; onAvatarSaved: () => void; }
interface Fields {
  name: string;
  phone: string;
  telegram: string;
  currentPassword: string;
  newPassword: string;
}

export function ProfileSettingsDialog({ open, onClose, onAvatarSaved }: Props) {
  const { user, updateProfile, loadProfile, saveAvatar } = useAuth();
  const { register, reset, handleSubmit, formState: { isSubmitting, errors } } = useForm<Fields>({ defaultValues: { name: user?.name ?? "", phone: "", telegram: "", currentPassword: "", newPassword: "" } });
  const [options, setOptions] = useState<AvatarOptions>(randomAvatarOptions);
  const [editorOpen, setEditorOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setMessage("");
    void loadProfile().then((profile) => {
      reset({
        name: profile.name,
        phone: profile.phone ?? "",
        telegram: profile.telegram ?? "",
        currentPassword: "",
        newPassword: "",
      });
      setOptions(parseAvatarPath(profile.avatarPath));
    }).catch(() => setMessage(t("profile.loadFailed")));
  }, [open, loadProfile, reset]);

  const submit = handleSubmit(async ({ name, phone, telegram, currentPassword, newPassword }) => {
    setMessage("");
    try {
      await updateProfile({
        name,
        phone: phone.trim() || null,
        telegram: telegram.trim() || null,
        ...(newPassword ? { currentPassword, newPassword } : {}),
      });
      reset({ name, phone, telegram, currentPassword: "", newPassword: "" });
      setMessage(t("profile.saved"));
    } catch (error) { setMessage(error instanceof ApiError ? error.message : t("profile.saveFailed")); }
  });

  async function saveNewAvatar(next: AvatarOptions, png: Blob) {
    await saveAvatar(png, JSON.stringify(next));
    setOptions(next);
    setEditorOpen(false);
    onAvatarSaved();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("profile.title")}</DialogTitle>
        </DialogHeader>
        <form className={"flex flex-col gap-4"} onSubmit={(event) => void submit(event)} noValidate>
          <div className={"flex items-center gap-4"}><div className={"sticky top-0 grid self-start gap-4 [&>img]:aspect-square [&>img]:w-full [&>img]:rounded-full [&>img]:bg-muted"}><AvatarPreview options={options} /></div><div><strong>{t("profile.avatar")}</strong><Button type="button" variant="outline" onClick={() => setEditorOpen(true)}>{t("profile.regenerate")}</Button></div></div>
          <TextField label={t("auth.name.label")} error={errors.name?.message} {...register("name", { required: t("auth.name.required") })} />
          <TextField label={t("contacts.phone")} autoComplete="tel" {...register("phone")} />
          <TextField label={t("contacts.telegram")} {...register("telegram")} />
          <TextField label={t("profile.currentPassword")} type="password" {...register("currentPassword")} />
          <TextField label={t("profile.newPassword")} type="password" error={errors.newPassword?.message} {...register("newPassword", { validate: (value) => !value || value.length >= 8 || t("auth.password.tooShort") })} />
          <p className={"-mt-2 text-xs text-muted-foreground"}>{t("profile.passwordHint")}</p>
          {message && <p className={"text-sm text-foreground"} role="status">{message}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t("action.cancel")}</Button><Button type="submit" disabled={isSubmitting}>{t("action.save")}</Button></DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
      <AvatarEditorDialog open={editorOpen} initial={options} onClose={() => setEditorOpen(false)} onSave={saveNewAvatar} />
    </>
  );
}
