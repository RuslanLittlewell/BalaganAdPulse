import { useState } from "react";
import { CodeIcon } from "lucide-react";
import { useCan } from "@/features/permissions/index.js";
import { WebsiteLeadsDialog } from "@/features/website-leads/index.js";
import { t } from "@/shared/config/index.js";
import { Button } from "@/shared/ui/index.js";
import { useSelectedBoard } from "./CrmNav.js";

export function WebsiteLeadsButton() {
  const manages = useCan("update", "lead-intake-key");
  const { board } = useSelectedBoard();
  const [open, setOpen] = useState(false);
  if (!manages || !board) return null;
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CodeIcon aria-hidden className="size-3.5" />
        {t("website.open")}
      </Button>
      <WebsiteLeadsDialog key={board.key} projectId={board.key} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
