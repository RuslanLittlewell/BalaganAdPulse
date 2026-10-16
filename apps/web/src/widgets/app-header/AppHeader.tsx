import { useState } from "react";
import { HistoryIcon, UserPlusIcon } from "lucide-react";
import { UserMenu, useAuth } from "@/features/auth/index.js";
import { HINTS, useHint } from "@/features/hints/index.js";
import { useClients } from "@/entities/client/index.js";
import { useMembers } from "@/entities/membership/index.js";
import { ProfileSettingsDialog } from "@/features/profile-settings/index.js";
import { ThemeToggle } from "@/features/theme-toggle/index.js";
import { Can } from "@/features/permissions/index.js";
import { ContactBook } from "@/widgets/contact-book/index.js";
import { OnlineUsers } from "@/widgets/online-users/index.js";
import { ActivityLogModal } from "@/widgets/activity-log-modal/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Hint,
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
    clients.isSuccess && clients.data.length === 0 &&
    staff.isSuccess && (staff.data ?? []).every((member) => member.userId === user?.id);
  return useHint(HINTS.contactsFirstPeople, empty && !contactsOpen);
}

export function AppHeader() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const firstPeople = useFirstPeopleHint(contactsOpen);
  return (
    <>
      <header className="flex min-h-16 w-full items-center justify-end gap-2 border-b border-border px-5">

        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-2">
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
              <div aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
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
              <div aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
            </Can>
          <OnlineUsers />
          <UserMenu onSettings={() => setSettingsOpen(true)} avatarVersion={avatarVersion} />
          <ThemeToggle />
          </div>
        </TooltipProvider>
      </header>
      <ContactBook open={contactsOpen} onClose={() => setContactsOpen(false)} />
      <ActivityLogModal open={activityOpen} onOpenChange={setActivityOpen} />
      <ProfileSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onAvatarSaved={() => setAvatarVersion((value) => value + 1)}
      />
    </>
  );
}
