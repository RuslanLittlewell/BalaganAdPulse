import { useState } from "react";
import { PencilIcon, PlusIcon, Trash2 } from "lucide-react";
import { ClientAvatar, useClients, useDeleteClient, type Client } from "@/entities/client/index.js";
import { refreshProjects } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Hint,
  ListItem,
  Loader,
  useAlerts,
} from "@/shared/ui/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { HINTS, useHint } from "@/features/hints/index.js";
import { ContactAvatar } from "./ContactAvatar.js";
import { ContactDetails } from "./ContactDetails.js";
import { ContactForm } from "./ContactForm.js";

type Mode = { kind: "view" } | { kind: "edit" } | { kind: "create" };

export function ClientDirectory() {
  const clients = useClients();
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [deleting, setDeleting] = useState<Client>();
  const remove = useDeleteClient();
  const { raise } = useAlerts();
  const list = clients.data ?? [];
  const selected = list.find((client) => client.id === selectedId) ?? list[0];
  const editing = mode.kind !== "view";
  const createsClients = useCan("create", "client");
  const firstClient = useHint(
    HINTS.contactsFirstClient,
    createsClients && clients.isSuccess && list.length === 0 && !editing,
  );

  function select(client: Client) {
    setSelectedId(client.id);
    setMode({ kind: "view" });
  }

  function confirmDelete(client: Client) {
    remove.mutate(client.id, {
      onSuccess: () => {
        setSelectedId(undefined);
        void refreshProjects();
      },
      onError: () => raise(t("contacts.delete.failed")),
      onSettled: () => setDeleting(undefined),
    });
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
    <div data-testid="contact-book-columns" className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(14rem,22%)_minmax(0,1fr)] sm:grid-rows-[minmax(0,1fr)]">
      <div data-testid="contact-book-list" className="relative flex min-h-0 min-w-0 flex-col">
        <div className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto pb-14">
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
            <Hint
              open={firstClient.open}
              text={t("hint.contacts.firstClient")}
              side="top"
              onDismiss={firstClient.dismiss}
            >
              <Button
                type="button"
                size="icon"
                className="absolute right-0 bottom-2 z-10 rounded-full shadow-md"
                aria-label={t("contacts.new")}
                onClick={() => setMode({ kind: "create" })}
              >
                <PlusIcon aria-hidden="true" />
              </Button>
            </Hint>
          </Can>
        )}
      </div>

      <div
        data-testid="contact-book-details"
        className="flex min-h-0 min-w-0 flex-col overflow-y-auto sm:border-l sm:border-border sm:pl-4"
      >
        {(mode.kind === "create" || selected != null) && (
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
                {selected != null && (
                  <Can action="delete" resource="client">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("contacts.delete")}
                      onClick={() => setDeleting(selected)}
                    >
                      <Trash2 />
                    </Button>
                  </Can>
                )}
              </div>
            )}
          </div>
        )}

        {mode.kind === "view" && selected != null && <ContactDetails client={selected} />}
        {mode.kind === "view" && selected == null && (
          <div className="grid flex-1 place-items-center">
            <EmptyState title={t("contacts.empty")} />
          </div>
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

      {deleting != null && (
        <ConfirmDialog
          open
          title={`${t("contacts.delete")} «${deleting.name}»?`}
          description={t("contacts.delete.body")}
          pending={remove.isPending}
          onConfirm={() => confirmDelete(deleting)}
          onClose={() => setDeleting(undefined)}
        />
      )}
    </div>
  );
}
