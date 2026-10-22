import { MinimizeIcon } from "lucide-react";
import { Button } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { usePreviewMode } from "../model/usePreviewMode.js";

export function LeavePreviewButton() {
  const { leave } = usePreviewMode();
  return (
    <Button type="button" variant="outline" size="sm" onClick={leave}>
      <MinimizeIcon aria-hidden />
      {t("preview.leave")}
    </Button>
  );
}
