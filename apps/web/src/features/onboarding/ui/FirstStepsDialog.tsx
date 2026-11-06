import { useLocation, useNavigate } from "react-router-dom";
import { CheckIcon, ChevronRightIcon, LockIcon } from "lucide-react";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/index.js";
import { useHideFirstSteps, useOnboarding, type OnboardingStep } from "../api.js";
import { useFirstStepsDialog } from "../model/firstSteps.js";
import { stepLink } from "../model/stepLinks.js";

function StepRow({ step, locked, onGo }: { step: OnboardingStep; locked: boolean; onGo: () => void }) {
  const title = t(`onboarding.step.${step.key}`);
  const why = t(`onboarding.step.${step.key}.why`);
  if (step.done) {
    return (
      <li data-step={step.key} data-done="true" className="flex items-start gap-3 rounded-lg p-2 text-muted-foreground">
        <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <span className="flex flex-col">
          <span className="text-sm font-medium line-through">{title}</span>
          <span className="sr-only">{t("onboarding.done")}</span>
        </span>
      </li>
    );
  }
  return (
    <li data-step={step.key} data-done="false" data-locked={locked ? "true" : "false"}>
      <Button
        type="button"
        variant="ghost"
        disabled={locked}
        onClick={onGo}
        className="h-auto w-full items-start justify-between gap-3 whitespace-normal p-2 text-left"
      >
        <span className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-input" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{title}</span>
            <span className="text-xs font-normal text-muted-foreground">{locked ? t("onboarding.locked") : why}</span>
          </span>
        </span>
        {locked
          ? <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          : <ChevronRightIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      </Button>
    </li>
  );
}

export function FirstStepsDialog() {
  const { organization, platformAdmin } = useAuth();
  const { open, close } = useFirstStepsDialog();
  const onboarding = useOnboarding(organization != null && !platformAdmin);
  const hide = useHideFirstSteps();
  const navigate = useNavigate();
  const location = useLocation();
  const steps = onboarding.data?.steps ?? [];
  const done = steps.filter((step) => step.done).length;
  const next = steps.findIndex((step) => !step.done);

  const go = (step: OnboardingStep) => {
    const link = stepLink(step.key, onboarding.data?.firstProjectId ?? null);
    close();
    navigate({ pathname: link.pathname ?? location.pathname, search: link.search ?? "" });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{t("onboarding.steps")}</DialogTitle>
          <DialogDescription>
            {t("onboarding.progress")} {done} {t("onboarding.of")} {steps.length}
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-1">
          {steps.map((step, index) => (
            <StepRow key={step.key} step={step} locked={index !== next} onGo={() => go(step)} />
          ))}
        </ol>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              hide.mutate();
              close();
            }}
          >
            {t("onboarding.skip")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
