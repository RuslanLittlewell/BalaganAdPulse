import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import { getLocale, reloadForLocale, saveLocale, type Locale } from "@/shared/config/locale.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TextField,
  useAlerts,
} from "@/shared/ui/index.js";
import { ApiError, getPreferredTheme, setTheme, type Theme } from "@/shared/lib/index.js";
import {
  AvatarPreview,
  parseAvatarPath,
  randomAvatarOptions,
  type AvatarOptions,
} from "@/features/avatar-editor/index.js";
import { AvatarEditorDialog } from "@/features/avatar-editor/index.js";
import { TelegramBotSection } from "@/features/telegram-bot/index.js";
import { readCampaignCrm, saveCampaignCrm } from "../model/preferences.js";

interface Props {
  open: boolean;
  onClose: () => void;
  onAvatarSaved: () => void;
}
interface Fields {
  name: string;
  phone: string;
  telegram: string;
  currentPassword: string;
  newPassword: string;
}

export function ProfileSettingsDialog({ open, onClose, onAvatarSaved }: Props) {
  const { user, updateProfile, loadProfile, saveAvatar } = useAuth();
  const {
    register,
    reset,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Fields>({
    defaultValues: {
      name: user?.name ?? "",
      phone: "",
      telegram: "",
      currentPassword: "",
      newPassword: "",
    },
  });
  const [options, setOptions] = useState<AvatarOptions>(randomAvatarOptions);
  const [editorOpen, setEditorOpen] = useState(false);
  const [tab, setTab] = useState("account");
  const [locale, setLocale] = useState<Locale>(getLocale);
  const [theme, setSelectedTheme] = useState<Theme>(getPreferredTheme);
  const [campaignCrm, setCampaignCrm] = useState(false);
  const { raise } = useAlerts();

  useEffect(() => {
    if (!open) return;
    setTab("account");
    setLocale(getLocale());
    setSelectedTheme(getPreferredTheme());
    setCampaignCrm(user ? readCampaignCrm(user.id) : false);
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return;
    void loadProfile()
      .then((profile) => {
        reset({
          name: profile.name,
          phone: profile.phone ?? "",
          telegram: profile.telegram ?? "",
          currentPassword: "",
          newPassword: "",
        });
        setOptions(parseAvatarPath(profile.avatarPath));
      })
      .catch(() => raise(t("profile.loadFailed")));
  }, [open, loadProfile, reset, raise]);

  const submit = handleSubmit(
    async ({ name, phone, telegram, currentPassword, newPassword }) => {
      try {
        await updateProfile({
          name,
          phone: phone.trim() || null,
          telegram: telegram.trim() || null,
          ...(newPassword ? { currentPassword, newPassword } : {}),
        });
        reset({ name, phone, telegram, currentPassword: "", newPassword: "" });
        raise(t("profile.saved"), "success");
        onClose();
      } catch (error) {
        raise(error instanceof ApiError ? error.message : t("profile.saveFailed"));
      }
    },
  );

  async function saveNewAvatar(next: AvatarOptions, png: Blob) {
    await saveAvatar(png, JSON.stringify(next));
    setOptions(next);
    setEditorOpen(false);
    onAvatarSaved();
  }

  function savePreferences() {
    if (!user) return;
    try {
      saveCampaignCrm(user.id, campaignCrm);
      setTheme(theme);
      const changed = saveLocale(locale);
      onClose();
      if (changed) reloadForLocale();
      else raise(t("profile.preferencesSaved"), "success");
    } catch {
      raise(t("profile.saveFailed"));
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="w-[min(760px,calc(100vw-2rem))] max-w-none h-auto">
          <DialogHeader>
            <DialogTitle>{t("profile.title")}</DialogTitle>
          </DialogHeader>
          <Tabs
            items={[
              { id: "account", label: t("profile.account") },
              { id: "general", label: t("profile.general") },
            ]}
            activeId={tab}
            onSelect={setTab}
            ariaLabel={t("profile.tabs")}
            className="w-full"
          />
          <div hidden={tab !== "general"}>
            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault();
                savePreferences();
              }}
            >
              <div className="flex flex-col gap-4 py-1">
                <div className="flex items-center justify-between gap-3">
                  <span id="profile-language-label" className="text-sm font-normal text-foreground">{t("profile.language")}</span>
                  <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
                    <SelectTrigger id="profile-language" aria-labelledby="profile-language-label" size="sm" className="w-32 shrink-0 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">{t("language.ru")}</SelectItem>
                      <SelectItem value="en">{t("language.en")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span id="profile-theme-label" className="text-sm font-normal text-foreground">{t("profile.theme")}</span>
                  <Select value={theme} onValueChange={(value) => setSelectedTheme(value as Theme)}>
                    <SelectTrigger id="profile-theme" aria-labelledby="profile-theme-label" size="sm" className="w-32 shrink-0 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t("theme.light")}</SelectItem>
                      <SelectItem value="dark">{t("theme.dark")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <TelegramBotSection />
                <div className="flex items-center justify-between gap-3">
                  <span id="profile-campaign-crm-label" className="text-sm font-normal text-foreground">{t("profile.campaignCrm")}</span>
                  <Switch
                    id="profile-campaign-crm"
                    aria-labelledby="profile-campaign-crm-label"
                    checked={campaignCrm}
                    onCheckedChange={setCampaignCrm}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("action.cancel")}
                </Button>
                <Button type="submit" disabled={!user}>{t("action.save")}</Button>
              </DialogFooter>
            </form>
          </div>
          <div hidden={tab !== "account"}>
            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => void submit(event)}
              noValidate
            >
              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
                <div className="flex flex-col items-center gap-2 sm:border-r sm:border-border sm:pr-5">
                  <div className="w-26 sm:w-full [&>img]:aspect-square [&>img]:w-full [&>img]:rounded-full">
                    <AvatarPreview options={options} />
                  </div>
                  <strong className="text-sm">{t("profile.avatar")}</strong>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setEditorOpen(true)}
                  >
                    {t("profile.regenerate")}
                  </Button>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <TextField
                    label={t("auth.name.label")}
                    error={errors.name?.message}
                    {...register("name", { required: t("auth.name.required") })}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label={t("contacts.phone")}
                      autoComplete="tel"
                      {...register("phone")}
                    />
                    <TextField
                      label={t("contacts.telegram")}
                      {...register("telegram")}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label={t("profile.currentPassword")}
                      type="password"
                      {...register("currentPassword")}
                    />
                    <TextField
                      label={t("profile.newPassword")}
                      type="password"
                      error={errors.newPassword?.message}
                      {...register("newPassword", {
                        validate: (value) =>
                          !value || value.length >= 8 || t("auth.password.tooShort"),
                      })}
                    />
                  </div>
                  <p className="-mt-2 text-xs text-muted-foreground">
                    {t("profile.passwordHint")}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("action.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {t("action.save")}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      <AvatarEditorDialog
        open={editorOpen}
        initial={options}
        onClose={() => setEditorOpen(false)}
        onSave={saveNewAvatar}
      />
    </>
  );
}
