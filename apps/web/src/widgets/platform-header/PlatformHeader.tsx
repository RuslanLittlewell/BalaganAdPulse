import { UserMenu } from "@/features/auth/index.js";
import { ThemeToggle } from "@/shared/ui/index.js";

export function PlatformHeader() {
  return (
    <header className="flex min-h-16 w-full items-center justify-end gap-2 border-b border-border px-5">
      <div className="flex items-center gap-2">
        <UserMenu canEditProfile={false} />
        <ThemeToggle />
      </div>
    </header>
  );
}
