import { useState } from "react";
import { UserPlusIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide";
import { MorphIcon } from "morphicons/react";
import { UserMenu } from "@/features/auth/index.js";
import { ProfileSettingsDialog } from "@/features/profile-settings/index.js";
import { ThemeToggle } from "@/features/theme-toggle/index.js";
import { ContactBook } from "@/widgets/contact-book/index.js";
import { useNavCollapse } from "@/features/nav-collapse/index.js";
import { t } from "@/shared/config/index.js";
import { Button } from "@/shared/ui/index.js";

export function AppHeader() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const { collapsed, toggle } = useNavCollapse();
  return (
    <>
      <header className="flex min-h-16 w-full items-center justify-between gap-2 border-b border-border px-5">
        {/* The chevron does not swap icons, it turns: morphicons derives the
            180 degrees from the two shapes rather than being told. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
          aria-expanded={!collapsed}
          onClick={toggle}
        >
          <MorphIcon icon={collapsed ? ChevronRight : ChevronLeft} size={18} spring="snappy" />
        </Button>

        <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("contacts.title")}
          onClick={() => setContactsOpen(true)}
        >
          <UserPlusIcon />
        </Button>
        <UserMenu onSettings={() => setSettingsOpen(true)} avatarVersion={avatarVersion} />
          <ThemeToggle />
        </div>
      </header>
      <ContactBook open={contactsOpen} onClose={() => setContactsOpen(false)} />
      <ProfileSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onAvatarSaved={() => setAvatarVersion((value) => value + 1)}
      />
    </>
  );
}
