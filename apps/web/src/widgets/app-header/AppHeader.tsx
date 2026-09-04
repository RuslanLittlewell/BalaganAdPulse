import { useState } from "react";
import { HistoryIcon, UserPlusIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide";
import { MorphIcon } from "morphicons/react";
import { UserMenu } from "@/features/auth/index.js";
import { ProfileSettingsDialog } from "@/features/profile-settings/index.js";
import { ThemeToggle } from "@/features/theme-toggle/index.js";
import { Can } from "@/features/permissions/index.js";
import { ContactBook } from "@/widgets/contact-book/index.js";
import { ActivityLogModal } from "@/widgets/activity-log-modal/index.js";
import { useNavCollapse } from "@/features/nav-collapse/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/index.js";

export function AppHeader() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const { collapsed, toggle } = useNavCollapse();
  return (
    <>
      <header className="flex min-h-16 w-full items-center justify-between gap-2 border-b border-border px-5">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
          aria-expanded={!collapsed}
          onClick={toggle}
        >
          <MorphIcon icon={collapsed ? ChevronRight : ChevronLeft} size={18} spring="snappy" />
        </Button>

        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-2">
            <Tooltip>
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
