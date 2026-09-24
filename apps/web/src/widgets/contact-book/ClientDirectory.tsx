import { useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { ClientAvatar, useClients, type Client } from "@/entities/client/index.js";
import { t } from "@/shared/config/index.js";
import { Button, EmptyState, ListItem, Loader } from "@/shared/ui/index.js";
import { Can } from "@/features/permissions/index.js";
import { ContactAvatar } from "./ContactAvatar.js";
import { ContactDetails } from "./ContactDetails.js";
import { ContactForm } from "./ContactForm.js";

type Mode = { kind: "view" } | { kind: "edit" } | { kind: "create" };

export function ClientDirectory() {
  const clients = useClients();
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const list = clients.data ?? [];
  const selected = list.find((client) => client.id === selectedId) ?? list[0];
  const editing = mode.kind !== "view";

  function select(client: Client) {
    setSelectedId(client.id);
    setMode({ kind: "view" });
  }

  if (clients.isPending) {
    return (
      <div className="grid place-items-center py-10">
        <Loader />
      </div>
    );
  }

  if (!clients.isSuccess) return null;

  return (
    <div
      data-testid="contact-book-columns flex-1"
      className="grid min-h-[22rem] gap-4 sm:grid-cols-[minmax(14rem,22%)_minmax(0,1fr)] flex-1"
    >
      <div data-testid="contact-book-list" className="relative min-w-0">
        <div className="flex max-h-[60vh] flex-col gap-1 overflow-auto pb-14">
          {list.map((client) => (
            <ListItem
              key={client.id}
              selected={!editing && client.id === selected?.id}
              leading={<ClientAvatar client={client} size="sm" />}
              onClick={() => select(client)}
            >
              <span className="block truncate" title={client.name}>{client.name}</span>
            </ListItem>
          ))}
        </div>
        {!editing && (
          <Can action="create" resource="client">
            <Button
              type="button"
              size="icon"
              className="absolute right-0 bottom-2 z-10 rounded-full shadow-md"
              aria-label={t("contacts.new")}
              onClick={() => setMode({ kind: "create" })}
            >
              <PlusIcon aria-hidden="true" />
            </Button>
          </Can>
        )}
      </div>

      <div
        data-testid="contact-book-details"
        className="max-h-[60vh] min-w-0 overflow-auto sm:border-l sm:border-border sm:pl-4"
      >
        <div className="mb-2 flex min-h-9 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {mode.kind !== "create" && selected != null && (
              <Can action="update" resource="client"><ContactAvatar client={selected} /></Can>
            )}
            <h3 className="min-w-0 truncate text-lg font-semibold">
              {mode.kind === "create" ? t("contacts.new") : selected?.name}
            </h3>
          </div>
          {!editing && (
            <div className="flex shrink-0 items-center gap-1">
              {selected != null && (
                <Can action="update" resource="client">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("contacts.edit")}
                  onClick={() => setMode({ kind: "edit" })}
                >
                  <PencilIcon />
                </Button>
                </Can>
              )}
            </div>
          )}
        </div>

        {mode.kind === "view" && selected != null && <ContactDetails client={selected} />}
        {mode.kind === "view" && selected == null && (
          <EmptyState title={t("contacts.empty")} />
        )}
        {editing && (
          <ContactForm
            client={mode.kind === "edit" ? selected : undefined}
            onDone={(client) => {
              setSelectedId(client.id);
              setMode({ kind: "view" });
            }}
            onCancel={() => setMode({ kind: "view" })}
          />
        )}
      </div>
    </div>
  );
}
