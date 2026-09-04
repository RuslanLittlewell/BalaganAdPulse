import { useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { isCustomer } from "@adpulse/access-policy";
import { ClientAvatar, useClients, type Client } from "@/entities/client/index.js";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ListItem,
  Loader,
  Tabs,
} from "@/shared/ui/index.js";
import { InvitationDialog } from "@/features/invitations/index.js";
import { ContactAvatar } from "./ContactAvatar.js";
import { CompanyTeam } from "./CompanyTeam.js";
import { EmployeeDirectory } from "./EmployeeDirectory.js";
import { ContactDetails } from "./ContactDetails.js";
import { ContactForm } from "./ContactForm.js";
import { Can } from "@/features/permissions/index.js";

export interface ContactBookProps {
  open: boolean;
  onClose: () => void;
}

type Mode = { kind: "view" } | { kind: "edit" } | { kind: "create" };

type Directory = "CLIENT" | "EMPLOYEE";

/**
 * The client list and one client's details, side by side. The list is the
 * navigation and the right pane is the only thing that changes, so selection
 * lives here rather than in the URL — closing the dialog should not leave a
 * route behind. The pencil turns that pane into a form over the same record;
 * the plus opens the same form with nothing in it.
 */
export function ContactBook({ open, onClose }: ContactBookProps) {
  // Clients first, because that is what the contact book has always opened on
  // and what most visits are for.
  const [directory, setDirectory] = useState<Directory>("CLIENT");
  const [inviting, setInviting] = useState(false);
  const clients = useClients();
  const { role, clientIds } = useAuth();
  const isAgency = role != null && !isCustomer(role);
  /* A customer reaches exactly one client — their own company — so there is
     nothing to choose between and nothing of the agency's to show. */
  const ownCompanyId = isAgency ? undefined : clientIds[0];
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
      {/* A floor rather than a fitted height: without it the book resizes as one
          clicks from a person with three fields to a person with six. */}
      <DialogContent className="min-h-[550px] w-[min(980px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{t("contacts.title")}</DialogTitle>
        </DialogHeader>

        {/* The employees pane is the agency's own staff, so a customer is not
            offered it — not as an empty list, and not as an error from an
            endpoint their role cannot read. */}
        <Tabs
          items={[
            { id: "CLIENT", label: t("contacts.directory.clients") },
            ...(isAgency
              ? [{ id: "EMPLOYEE", label: t("contacts.directory.employees") }]
              : []),
          ]}
          activeId={directory}
          onSelect={(id) => {
            setDirectory(id as Directory);
            // Switching directory abandons an edit rather than carrying it into
            // a pane that has nothing to do with it.
            setMode({ kind: "view" });
          }}
        />

        {!isAgency && ownCompanyId != null && <CompanyTeam clientId={ownCompanyId} />}

        {isAgency && directory === "EMPLOYEE" && <EmployeeDirectory />}

        {isAgency && directory === "CLIENT" && clients.isPending && (
          <div className="grid place-items-center py-10">
            <Loader />
          </div>
        )}

        {isAgency && directory === "CLIENT" && clients.isSuccess && (
          // A fixed floor rather than a share of the dialog: a name and a
          // surname have to fit, and a fifth of the width is enough for one word.
          <div
            data-testid="contact-book-columns"
            className="grid min-h-[22rem] gap-4 sm:grid-cols-[minmax(14rem,22%)_minmax(0,1fr)]"
          >
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
                    <Can action="create" resource="client">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("contacts.new")}
                      onClick={() => setMode({ kind: "create" })}
                    >
                      <PlusIcon />
                    </Button>
                    </Can>
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
        {/* Inviting a whole new company is the agency's business. A customer's
            own invite control lives beside their people, where it means
            something. */}
        <DialogFooter data-testid="contact-book-footer" hidden={!isAgency}>
          <Can action="create" resource="invite">
            <Button onClick={() => setInviting(true)}>
              {directory === "EMPLOYEE"
                ? t("invites.createEmployee")
                : t("invites.createClient")}
            </Button>
          </Can>
        </DialogFooter>

        {/* Over the contact book rather than inside a pane: the form has a role,
            a project list and its own validation, and what is behind it is the
            list of who is already here. */}
        <InvitationDialog
          registrationType={directory}
          open={inviting}
          onClose={() => setInviting(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
