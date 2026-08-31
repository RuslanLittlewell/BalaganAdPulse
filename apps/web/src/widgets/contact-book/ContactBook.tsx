import { useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { ClientAvatar, useClients, type Client } from "@/entities/client/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ListItem,
  Loader,
} from "@/shared/ui/index.js";
import { ContactAvatar } from "./ContactAvatar.js";
import { ContactDetails } from "./ContactDetails.js";
import { ContactForm } from "./ContactForm.js";

export interface ContactBookProps {
  open: boolean;
  onClose: () => void;
}

type Mode = { kind: "view" } | { kind: "edit" } | { kind: "create" };

/**
 * The client list and one client's details, side by side. The list is the
 * navigation and the right pane is the only thing that changes, so selection
 * lives here rather than in the URL — closing the dialog should not leave a
 * route behind. The pencil turns that pane into a form over the same record;
 * the plus opens the same form with nothing in it.
 */
export function ContactBook({ open, onClose }: ContactBookProps) {
  const clients = useClients();
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const list = clients.data ?? [];
  // Falls back to the first client, so the right pane is never blank on open.
  const selected = list.find((client) => client.id === selectedId) ?? list[0];

  function select(client: Client) {
    setSelectedId(client.id);
    // Choosing another contact abandons an edit rather than carrying it over.
    setMode({ kind: "view" });
  }

  function close() {
    setMode({ kind: "view" });
    onClose();
  }

  const editing = mode.kind !== "view";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="w-[min(980px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{t("contacts.title")}</DialogTitle>
        </DialogHeader>

        {clients.isPending && (
          <div className="grid place-items-center py-10">
            <Loader />
          </div>
        )}

        {clients.isSuccess && (
          <div className="grid min-h-[22rem] gap-4 sm:grid-cols-[20%_minmax(0,1fr)]">
            <div className="flex max-h-[60vh] flex-col gap-1 overflow-auto sm:pr-4">
              {list.map((client) => (
                <ListItem
                  key={client.id}
                  selected={!editing && client.id === selected?.id}
                  leading={<ClientAvatar client={client} size="sm" />}
                  onClick={() => select(client)}
                >
                  {client.name}
                </ListItem>
              ))}
            </div>

            <div className="max-h-[60vh] min-w-0 overflow-auto sm:border-l sm:border-border sm:pl-4">
              <div className="mb-2 flex min-h-9 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  {/* Only a saved client has a picture to change. */}
                  {mode.kind !== "create" && selected != null && (
                    <ContactAvatar client={selected} />
                  )}
                  <h3 className="min-w-0 truncate text-lg font-semibold">
                    {mode.kind === "create" ? t("contacts.new") : selected?.name}
                  </h3>
                </div>
                {!editing && (
                  <div className="flex shrink-0 items-center gap-1">
                    {selected != null && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("contacts.edit")}
                        onClick={() => setMode({ kind: "edit" })}
                      >
                        <PencilIcon />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("contacts.new")}
                      onClick={() => setMode({ kind: "create" })}
                    >
                      <PlusIcon />
                    </Button>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
