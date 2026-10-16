import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { Button } from "@/shared/ui/index.js";
import { OrganizationFormDialog } from "./OrganizationFormDialog.js";

export function AddOrganization() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><PlusIcon /> {t("platform.organizations.add")}</Button>
      <OrganizationFormDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
