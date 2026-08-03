import { Avatar } from "../../../../components/Avatar/Avatar.js";
import { Button } from "../../../../components/Button/Button.js";
import { t } from "../../../../i18n/en.js";
import type { Client } from "../../data/api.js";
import styles from "./ClientHeader.module.css";

export interface ClientHeaderProps {
  client: Client;
  onEdit: () => void;
  onDelete: () => void;
}

export function ClientHeader({ client, onEdit, onDelete }: ClientHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <Avatar name={client.name} size="lg" />
        <h1 className={styles.name}>{client.name}</h1>
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {t("client.edit")}
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          {t("client.delete")}
        </Button>
      </div>
    </header>
  );
}
