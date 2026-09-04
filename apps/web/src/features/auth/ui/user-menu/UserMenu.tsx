import { ChevronDown, LogOut, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "@/shared/config/index.js";
import { Loader } from "@/shared/ui/index.js";
import { hasSession } from "@/shared/lib/index.js";
import { useAuth } from "../../model/AuthProvider.js";
import { UserAvatar } from "../user-avatar/UserAvatar.js";

export interface UserMenuProps {
  onSettings?: () => void;
  avatarVersion?: number;
}

export function UserMenu({ onSettings, avatarVersion }: UserMenuProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!user) return hasSession() ? <Loader size="sm" /> : null;

  return (
    <div className={"relative"} ref={menuRef}>
      <button
        type="button"
        className={"flex items-center gap-3 rounded-md p-1.5 hover:bg-accent"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <UserAvatar userId={user.id} name={user.name} version={avatarVersion} />
        <span className={"grid min-w-0 text-left"}>
          <span className={"truncate font-semibold"}>{user.name}</span>
          <span className={"text-xs text-muted-foreground"}>{user.email}</span>
        </span>
        <ChevronDown className={"size-4 text-muted-foreground"} aria-hidden="true" />
      </button>

      {open && (
        <div className={"absolute right-0 top-full z-40 mt-2 grid min-w-48 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg [&>button]:flex [&>button]:items-center [&>button]:gap-2 [&>button]:rounded-sm [&>button]:px-3 [&>button]:py-2 [&>button]:text-sm [&>button:hover]:bg-accent [&_svg]:size-4"} role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onSettings?.(); }}>
            <Settings aria-hidden="true" />
            {t("account.settings")}
          </button>
          <button type="button" role="menuitem" onClick={() => void logout()}>
            <LogOut aria-hidden="true" />
            {t("auth.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
