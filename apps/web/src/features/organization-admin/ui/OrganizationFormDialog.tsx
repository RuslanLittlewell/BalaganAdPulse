import { useEffect, useState, type FormEvent } from "react";
import { isOptionalModule, type OptionalModule } from "@adpulse/access-policy";
import {
  useCreateOrganization,
  useUpdateOrganization,
  type PlatformOrganization,
} from "@/entities/platform-organization/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError, isEmail } from "@/shared/lib/index.js";
import {
  Button,
  CopyButton,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TextField,
} from "@/shared/ui/index.js";
import { registrationLink } from "../lib/link.js";
import { ModuleChoices } from "./ModuleChoices.js";

export interface OrganizationFormDialogProps {
  organization?: PlatformOrganization;
  open: boolean;
  onClose: () => void;
}

interface Problems {
  name?: string;
  adminEmail?: string;
}

const optionalModulesOf = (organization?: PlatformOrganization): OptionalModule[] =>
  (organization?.modules ?? []).filter(isOptionalModule);

export function OrganizationFormDialog({ organization, open, onClose }: OrganizationFormDialogProps) {
  const create = useCreateOrganization();
  const update = useUpdateOrganization();
  const editing = organization != null;
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [modules, setModules] = useState<OptionalModule[]>([]);
  const [problems, setProblems] = useState<Problems>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(organization?.name ?? "");
    setAdminEmail("");
    setModules(optionalModulesOf(organization));
    setProblems({});
    setFailure(null);
    setCreatedLink(null);
  }, [open, organization]);

  const pending = create.isPending || update.isPending;

  function validate(): Problems {
    const found: Problems = {};
    if (name.trim() === "") found.name = t("platform.form.nameRequired");
    if (!editing && !isEmail(adminEmail.trim())) found.adminEmail = t("platform.form.emailInvalid");
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    setFailure(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: organization.id, change: { name: name.trim(), modules } });
        onClose();
        return;
      }
      const created = await create.mutateAsync({ name: name.trim(), modules, adminEmail: adminEmail.trim() });
      setCreatedLink(registrationLink(created.registrationUrl));
    } catch (error) {
      setFailure(error instanceof ApiError && error.status === 409
        ? t("platform.form.emailTaken")
        : t("platform.form.failed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-[min(560px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{editing ? t("platform.form.editTitle") : t("platform.form.createTitle")}</DialogTitle>
        </DialogHeader>

        {createdLink ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t("platform.form.created")}</p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
              <code className="min-w-0 flex-1 break-all text-sm">{createdLink}</code>
              <CopyButton value={createdLink} label={t("platform.copyLink")} />
            </div>
            <DialogFooter>
              <Button type="button" onClick={onClose}>{t("invites.done")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void submit(event)}>
            <TextField
              label={t("platform.form.name")}
              value={name}
              error={problems.name}
              onChange={(event) => setName(event.target.value)}
            />
            {!editing && (
              <TextField
                label={t("platform.form.adminEmail")}
                type="email"
                value={adminEmail}
                error={problems.adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
              />
            )}
            <ModuleChoices selected={modules} onChange={setModules} />
            {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
              <Button type="submit" disabled={pending}>
                {editing ? t("action.save") : t("platform.form.create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
