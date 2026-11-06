import { useState } from "react";
import type { Role } from "@adpulse/access-policy";
import { useAuth } from "@/features/auth/index.js";
import { t, type MessageKey } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/index.js";
import { useOnboarding, useWelcomed } from "../api.js";
import { remainingSteps, useFirstStepsDialog } from "../model/firstSteps.js";

const WELCOME_TEXT: Readonly<Record<Role, MessageKey>> = {
  ADMIN: "onboarding.welcome.ADMIN",
  MANAGER: "onboarding.welcome.MANAGER",
  GUEST: "onboarding.welcome.GUEST",
  CLIENT: "onboarding.welcome.CLIENT",
  CLIENT_ADMIN: "onboarding.welcome.CLIENT",
};

export function WelcomeDialog() {
  const { organization, platformAdmin, role } = useAuth();
  const onboarding = useOnboarding(organization != null && !platformAdmin);
  const welcomed = useWelcomed();
  const showSteps = useFirstStepsDialog((state) => state.show);
  const [closed, setClosed] = useState(false);
  const data = onboarding.data;
  if (!role || !data || data.welcomed || closed) return null;
  const leadsToSteps = remainingSteps(data) > 0;

  const close = (thenSteps: boolean) => {
    setClosed(true);
    welcomed.mutate();
    if (thenSteps) showSteps();
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next) close(false); }}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{t("onboarding.welcome.title")}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{t(WELCOME_TEXT[role])}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {leadsToSteps ? (
            <Button type="button" onClick={() => close(true)}>{t("onboarding.welcome.start")}</Button>
          ) : (
            <Button type="button" onClick={() => close(false)}>{t("onboarding.welcome.close")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
