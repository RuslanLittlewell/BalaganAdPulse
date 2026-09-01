import { ClientAvatar } from "../client-avatar/ClientAvatar.js";
import { Button } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import type { Client } from "../../api/api.js";

export interface ClientHeaderProps {
  client: Client;
  onEdit: () => void;
  onDelete: () => void;
}

export function ClientHeader({ client, onEdit, onDelete }: ClientHeaderProps) {
  return (
    <header className={"flex min-h-16 items-center justify-between gap-4 border-b border-border px-5"}>
      <div className={"grid min-w-0 text-left"}>
        <ClientAvatar client={client} size="lg" />
        <h1 className={"truncate font-semibold"}>{client.name}</h1>
      </div>
      <div className={"flex items-center justify-end gap-2"}>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {t("client.edit")}
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          {t("client.delete")}
        </Button>
      </div>
    </header>
  );
}
