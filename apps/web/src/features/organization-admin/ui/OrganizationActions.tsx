import { useState, type ReactNode } from "react";
import { PencilIcon, PowerIcon, Trash2Icon } from "lucide-react";
import {
  useUpdateOrganization,
  type PlatformOrganization,
  type PlatformOrganizationStatus,
} from "@/entities/platform-organization/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  ConfirmDialog,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useAlerts,
} from "@/shared/ui/index.js";
import { DeleteOrganizationDialog } from "./DeleteOrganizationDialog.js";
import { OrganizationFormDialog } from "./OrganizationFormDialog.js";

interface IconActionProps {
  action: string;
  organization: string;
  icon: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}

function IconAction({ action, organization, icon, disabled, destructive, onClick }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${action}: ${organization}`}
          className={destructive ? "text-destructive hover:text-destructive" : undefined}
          disabled={disabled}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{action}</TooltipContent>
    </Tooltip>
  );
}

export function OrganizationActions({ organization }: { organization: PlatformOrganization }) {
  const update = useUpdateOrganization();
  const alerts = useAlerts();
  const [editing, setEditing] = useState(false);
  const [confirmingSuspension, setConfirmingSuspension] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const suspended = organization.status === "SUSPENDED";

  async function setStatus(status: PlatformOrganizationStatus) {
    try {
      await update.mutateAsync({ id: organization.id, change: { status } });
    } catch {
      alerts.raise(t("platform.status.failed"));
    } finally {
      setConfirmingSuspension(false);
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-end gap-1">
        <IconAction
          action={t("platform.edit")}
          organization={organization.name}
          icon={<PencilIcon />}
          onClick={() => setEditing(true)}
        />
        <IconAction
          action={suspended ? t("platform.reactivate") : t("platform.suspend")}
          organization={organization.name}
          icon={<PowerIcon />}
          disabled={update.isPending}
          onClick={() => (suspended ? void setStatus("ACTIVE") : setConfirmingSuspension(true))}
        />
        <IconAction
          action={t("platform.delete")}
          organization={organization.name}
          icon={<Trash2Icon />}
          destructive
          onClick={() => setDeleting(true)}
        />
      </div>
      <OrganizationFormDialog organization={organization} open={editing} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={confirmingSuspension}
        title={t("platform.suspend.title")}
        description={`${organization.name}. ${t("platform.suspend.description")}`}
        confirmLabel={t("platform.suspend")}
        pending={update.isPending}
        onConfirm={() => void setStatus("SUSPENDED")}
        onClose={() => setConfirmingSuspension(false)}
      />
      <DeleteOrganizationDialog organization={organization} open={deleting} onClose={() => setDeleting(false)} />
    </TooltipProvider>
  );
}
