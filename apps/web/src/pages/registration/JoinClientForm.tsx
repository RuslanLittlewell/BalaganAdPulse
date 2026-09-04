import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, TextField } from "@/shared/ui/index.js";
import { ApiError, isEmail } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useAuth } from "@/features/auth/index.js";
import { AvatarStep, NO_AVATAR, type ChosenAvatar } from "./AvatarStep.js";
import { MIN_PASSWORD, optional, saveChosenAvatar } from "./registration.js";

interface Values {
  name: string;
  email: string;
  password: string;
  confirmation: string;
  phone: string;
  telegram: string;
}

export function JoinClientForm({ code }: { code: string }) {
  const { register: join, saveAvatar, logout } = useAuth();
  const [avatar, setAvatar] = useState<ChosenAvatar>(NO_AVATAR);
  const [failure, setFailure] = useState<string | null>(null);

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } =
    useForm<Values>({
      defaultValues: {
        name: "", email: "", password: "", confirmation: "", phone: "", telegram: "",
      },
    });

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await join({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        inviteCode: code,
        phone: optional(values.phone),
        telegram: optional(values.telegram),
      });
      await saveChosenAvatar(avatar, saveAvatar);
      await logout();
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t("state.error.title"));
    }
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
      {failure != null && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {failure}
        </p>
      )}

      <TextField
        label={t("auth.name.label")}
        autoComplete="name"
        error={errors.name?.message}
        {...register("name", {
          validate: (value) => Boolean(value.trim()) || t("auth.name.required"),
        })}
      />
      <TextField
        label={t("auth.email.label")}
        type="email"
        autoComplete="username"
        error={errors.email?.message}
        {...register("email", {
          validate: (value) => isEmail(value.trim()) || t("auth.email.invalid"),
        })}
      />
      <TextField
        label={t("auth.password.label")}
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password", {
          required: t("registration.password.required"),
          minLength: { value: MIN_PASSWORD, message: t("auth.password.tooShort") },
        })}
      />
      <TextField
        label={t("registration.password.confirm")}
        type="password"
        autoComplete="new-password"
        error={errors.confirmation?.message}
        {...register("confirmation", {
          required: t("registration.password.confirmRequired"),
          validate: (value) =>
            value === getValues("password") || t("registration.password.mismatch"),
        })}
      />

      <TextField label={t("contacts.phone")} autoComplete="tel" {...register("phone")} />
      <TextField label={t("contacts.telegram")} {...register("telegram")} />

      <AvatarStep value={avatar} onChange={setAvatar} />

      <Button type="submit" disabled={isSubmitting}>{t("registration.submit")}</Button>
    </form>
  );
}
