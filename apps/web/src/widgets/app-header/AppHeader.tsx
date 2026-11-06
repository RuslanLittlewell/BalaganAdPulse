import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GaugeIcon, HistoryIcon, UserPlusIcon } from "lucide-react";
import { UserMenu, useAuth } from "@/features/auth/index.js";
import { HINTS, useHint } from "@/features/hints/index.js";
import { useClients } from "@/entities/client/index.js";
import { useMembers } from "@/entities/membership/index.js";
import { ProfileSettingsDialog } from "@/features/profile-settings/index.js";
import { TariffDialog, TrialBanner } from "@/features/tariff-status/index.js";
import { Can } from "@/features/permissions/index.js";
import { ContactBook, type ContactDirectory } from "@/widgets/contact-book/index.js";
import { CONTACTS_PARAM, PROFILE_PARAM } from "@/features/onboarding/index.js";
import { OnlineUsers } from "@/widgets/online-users/index.js";
import { ActivityLogModal } from "@/widgets/activity-log-modal/index.js";
import { NotificationCenter } from "@/widgets/notification-center/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Hint,
  ThemeToggle,
  ToolbarDivider,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/index.js";

function useFirstPeopleHint(contactsOpen: boolean) {
  const { user, role } = useAuth();
  const isAdmin = role === "ADMIN";
  const clients = useClients();
  const staff = useMembers();
  const empty =
    isAdmin &&
    clients.isSuccess &&
    clients.data.length === 0 &&
    staff.isSuccess &&
    (staff.data ?? []).every((member) => member.userId === user?.id);
  return useHint(HINTS.contactsFirstPeople, empty && !contactsOpen);
}

const DIRECTORY_PARAMS: Readonly<Record<string, ContactDirectory>> = {
  clients: "CLIENT",
  employees: "EMPLOYEE",
};

function useDialogLinks(openContacts: (directory: ContactDirectory) => void, openProfile: () => void) {
  const [params, setParams] = useSearchParams();
  const contacts = params.get(CONTACTS_PARAM);
  const profile = params.get(PROFILE_PARAM);
  useEffect(() => {
    if (contacts == null && profile == null) return;
    const directory = contacts == null ? undefined : DIRECTORY_PARAMS[contacts];
    if (directory) openContacts(directory);
    if (profile === "open") openProfile();
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete(CONTACTS_PARAM);
      next.delete(PROFILE_PARAM);
      return next;
    }, { replace: true });
  }, [contacts, profile, openContacts, openProfile, setParams]);
}

export function AppHeader() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactsDirectory, setContactsDirectory] = useState<ContactDirectory | undefined>(undefined);
  const [activityOpen, setActivityOpen] = useState(false);
  const [tariffOpen, setTariffOpen] = useState(false);
  const { role, tariff } = useAuth();
  const [avatarVersion, setAvatarVersion] = useState(0);
  const firstPeople = useFirstPeopleHint(contactsOpen);
  const openContacts = useCallback((directory: ContactDirectory) => {
    setContactsDirectory(directory);
    setContactsOpen(true);
  }, []);
  const openProfile = useCallback(() => setSettingsOpen(true), []);
  useDialogLinks(openContacts, openProfile);
  return (
    <>
      <header className="flex min-h-13 w-full items-center justify-end gap-2 border-b border-border px-4">
        <TrialBanner />
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <ToolbarDivider />
            <Tooltip>
              <Hint
                open={firstPeople.open}
                text={t("hint.contacts.firstPeople")}
                onDismiss={firstPeople.dismiss}
              >
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("contacts.title")}
                    onClick={() => setContactsOpen(true)}
                  >
                    <UserPlusIcon />
                  </Button>
                </TooltipTrigger>
              </Hint>
              <TooltipContent>{t("contacts.title")}</TooltipContent>
            </Tooltip>
            <Can action="read" resource="audit">
              <ToolbarDivider />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("activity.title")}
                    onClick={() => setActivityOpen(true)}
                  >
                    <HistoryIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("activity.title")}</TooltipContent>
              </Tooltip>
            </Can>
            {role === "ADMIN" && tariff && (
              <>
                <ToolbarDivider />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("tariff.title")}
                      onClick={() => setTariffOpen(true)}
                    >
                      <GaugeIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("tariff.title")}</TooltipContent>
                </Tooltip>
              </>
            )}
            <ToolbarDivider />
            <OnlineUsers />
            <UserMenu
              onSettings={() => setSettingsOpen(true)}
              avatarVersion={avatarVersion}
            />
            <ThemeToggle />
          </div>
        </TooltipProvider>
      </header>
      <ContactBook
        open={contactsOpen}
        initialDirectory={contactsDirectory}
        onClose={() => {
          setContactsOpen(false);
          setContactsDirectory(undefined);
        }}
      />
      <ActivityLogModal open={activityOpen} onOpenChange={setActivityOpen} />
      <TariffDialog open={tariffOpen} onClose={() => setTariffOpen(false)} />
      <ProfileSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onAvatarSaved={() => setAvatarVersion((value) => value + 1)}
      />
    </>
  );
}
