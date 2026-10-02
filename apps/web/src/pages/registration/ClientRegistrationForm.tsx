import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Step, Stepper, TextField } from "@/shared/ui/index.js";
import { ApiError, isEmail, isPartialDecimal } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useAuth } from "@/features/auth/index.js";
import { AvatarStep, NO_AVATAR, type ChosenAvatar } from "./AvatarStep.js";
import { MIN_PASSWORD, optional, saveChosenAvatar } from "./registration.js";

interface AccountValues {
  name: string;
  email: string;
  password: string;
  confirmation: string;
  organization: string;
  phone: string;
  telegram: string;
  website: string;
}

interface ProjectValues {
  projectName: string;
}

export function ClientRegistrationForm({ code }: { code: string }) {
  const { register: join, saveAvatar, logout } = useAuth();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState<ChosenAvatar>(NO_AVATAR);
  const [failure, setFailure] = useState<string | null>(null);

  const account = useForm<AccountValues>({
    defaultValues: {
      name: "", email: "", password: "", confirmation: "",
      organization: "", phone: "", telegram: "", website: "",
    },
  });
  const project = useForm<ProjectValues>({
    defaultValues: {
      projectName: "",
    },
  });

  async function create(): Promise<boolean> {
    if (!(await project.trigger())) return false;
    const contact = account.getValues();
    const values = project.getValues();
    setFailure(null);
    try {
      await join({
        name: contact.name.trim(),
        email: contact.email.trim(),
        password: contact.password,
        inviteCode: code,
        phone: optional(contact.phone),
        telegram: optional(contact.telegram),
        client: {
          name: contact.name.trim(),
          organization: optional(contact.organization),
          phone: optional(contact.phone),
          telegram: optional(contact.telegram),
          website: optional(contact.website),
          email: contact.email.trim(),
        },
        project: {
          name: values.projectName.trim(),
        },
      });
      await saveChosenAvatar(avatar, saveAvatar);
      await logout();
      return true;
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t("state.error.title"));
      return false;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {failure != null && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {failure}
        </p>
      )}

      <Stepper
        onBeforeNext={(from) => (from === 1 ? account.trigger() : create())}
        stepAriaLabel={(n) => `${t("stepper.step")} ${n}`}
        backButtonText={t("registration.back")}
        nextButtonText={t("registration.next")}
        completeButtonText={t("action.create")}
      >
        <Step>
          <div
            data-testid="registration-account-columns"
            className="grid gap-6 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-4" data-testid="registration-account-column">
              <TextField
                label={t("auth.name.label")}
                autoComplete="name"
                error={account.formState.errors.name?.message}
                {...account.register("name", {
                  validate: (value) => Boolean(value.trim()) || t("auth.name.required"),
                })}
              />
              <TextField
                label={t("auth.email.label")}
                type="email"
                autoComplete="username"
                error={account.formState.errors.email?.message}
                {...account.register("email", {
                  validate: (value) => isEmail(value.trim()) || t("auth.email.invalid"),
                })}
              />
              <TextField
                label={t("auth.password.label")}
                type="password"
                autoComplete="new-password"
                error={account.formState.errors.password?.message}
                {...account.register("password", {
                  required: t("registration.password.required"),
                  minLength: { value: MIN_PASSWORD, message: t("auth.password.tooShort") },
                })}
              />
              <TextField
                label={t("registration.password.confirm")}
                type="password"
                autoComplete="new-password"
                error={account.formState.errors.confirmation?.message}
                {...account.register("confirmation", {
                  required: t("registration.password.confirmRequired"),
                  validate: (value) =>
                    value === account.getValues("password")
                    || t("registration.password.mismatch"),
                })}
              />

              <AvatarStep value={avatar} onChange={setAvatar} />
            </div>

            <div
              data-testid="registration-contact-column"
              className="flex flex-col gap-4 sm:border-l sm:border-border sm:pl-6"
            >
              <TextField
                label={t("contacts.organization")}
                error={account.formState.errors.organization?.message}
                {...account.register("organization", {
                  validate: (value) =>
                    Boolean(value.trim()) || t("registration.organization.required"),
                })}
              />
              <TextField label={t("contacts.phone")} {...account.register("phone")} />
              <TextField label={t("contacts.telegram")} {...account.register("telegram")} />
              <TextField label={t("contacts.website")} {...account.register("website")} />
            </div>
          </div>
        </Step>

        <Step>
          <div className="flex flex-col gap-4">
            <TextField
              label={t("registration.project.name")}
              error={project.formState.errors.projectName?.message}
              {...project.register("projectName", {
                validate: (value) => Boolean(value.trim()) || t("project.name.required"),
              })}
            />
          </div>
        </Step>
      </Stepper>
    </div>
  );
}
