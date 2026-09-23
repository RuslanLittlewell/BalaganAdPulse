import { useState } from "react";
import { isCustomer } from "@adpulse/access-policy";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
} from "@/shared/ui/index.js";
import { InvitationDialog } from "@/features/invitations/index.js";
import { CompanyTeam } from "./CompanyTeam.js";
import { EmployeeDirectory } from "./EmployeeDirectory.js";
import { ClientDirectory } from "./ClientDirectory.js";
import { Can } from "@/features/permissions/index.js";

export interface ContactBookProps {
  open: boolean;
  onClose: () => void;
}

type Directory = "CLIENT" | "EMPLOYEE";

export function ContactBook({ open, onClose }: ContactBookProps) {
  const [directory, setDirectory] = useState<Directory>("CLIENT");
  const [inviting, setInviting] = useState(false);
  const { role, clientIds } = useAuth();
  const isAgency = role != null && !isCustomer(role);
  const ownCompanyId = isAgency ? undefined : clientIds[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="h-[38rem] w-[min(980px,calc(100vw-2rem))] max-w-none flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("contacts.title")}</DialogTitle>
        </DialogHeader>

        <Tabs
          items={[
            { id: "CLIENT", label: t("contacts.directory.clients") },
            ...(isAgency
              ? [{ id: "EMPLOYEE", label: t("contacts.directory.employees") }]
              : []),
          ]}
          activeId={directory}
          onSelect={(id) => setDirectory(id as Directory)}
          ariaLabel={t("contacts.directory.label")}
        />

        {!isAgency && ownCompanyId != null && (
          <CompanyTeam clientId={ownCompanyId} />
        )}

        {isAgency && directory === "EMPLOYEE" && <EmployeeDirectory />}

        {isAgency && directory === "CLIENT" && <ClientDirectory />}

        <DialogFooter data-testid="contact-book-footer" hidden={!isAgency}>
          <Can action="create" resource="invite">
            <Button onClick={() => setInviting(true)}>
              {directory === "EMPLOYEE"
                ? t("invites.createEmployee")
                : t("invites.createClient")}
            </Button>
          </Can>
        </DialogFooter>

        <InvitationDialog
          registrationType={directory}
          open={inviting}
          onClose={() => setInviting(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
