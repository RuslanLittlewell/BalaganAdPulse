import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "../../../../components/Sidebar/Sidebar.js";
import { SectionLabel } from "../../../../components/SectionLabel/SectionLabel.js";
import { ListItem } from "../../../../components/ListItem/ListItem.js";
import { Avatar } from "../../../../components/Avatar/Avatar.js";
import { Button } from "../../../../components/Button/Button.js";
import { Loader } from "../../../../components/Loader/Loader.js";
import { t } from "../../../../i18n/en.js";
import { useClients } from "../../data/queries.js";
import { UserMenu } from "../../../auth/components/UserMenu/UserMenu.js";
import { BrandHeader } from "../BrandHeader/BrandHeader.js";
import { ClientFormDialog } from "../ClientFormDialog/ClientFormDialog.js";
import styles from "./ClientSidebar.module.css";

export function ClientSidebar() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const clients = useClients();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <Sidebar
        header={<BrandHeader />}
        action={
          <Button variant="dashed" style={{ width: "100%" }} onClick={() => setCreating(true)}>
            + {t("clients.new")}
          </Button>
        }
        footer={<UserMenu />}
      >
        <SectionLabel>{t("clients.section")}</SectionLabel>

        {clients.isPending && (
          <div className={styles.state}>
            <Loader size="sm" />
          </div>
        )}

        {clients.isError && (
          <div className={styles.state}>
            <p className={styles.stateText}>{t("state.error.title")}</p>
            <Button variant="ghost" size="sm" onClick={() => clients.refetch()}>
              {t("state.retry")}
            </Button>
          </div>
        )}

        {clients.isSuccess &&
          clients.data.map((client) => (
            <ListItem
              key={client.id}
              selected={client.id === clientId}
              leading={<Avatar name={client.name} size="sm" />}
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              {client.name}
            </ListItem>
          ))}
      </Sidebar>

      {creating && (
        <ClientFormDialog
          onClose={() => setCreating(false)}
          onCreated={(client) => navigate(`/clients/${client.id}`)}
        />
      )}
    </>
  );
}
