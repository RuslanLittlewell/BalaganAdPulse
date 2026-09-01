import type { ReactNode } from "react";
import type { Client } from "@/entities/client/index.js";
import { CONTACT_FIELDS } from "./fields.js";

function Field({ label, value, href }: { label: string; value: string | null; href?: string }) {
  let content: ReactNode = <span className="text-muted-foreground">—</span>;
  if (value) {
    content = href ? (
      <a
        className="text-primary underline-offset-4 hover:underline"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {value}
      </a>
    ) : (
      value
    );
  }
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-baseline sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm">{content}</dd>
    </div>
  );
}

export function ContactDetails({ client }: { client: Client }) {
  return (
    <dl className="divide-y divide-border">
      {CONTACT_FIELDS.map((field) => {
        const value = client[field.key];
        return (
          <Field
            key={field.key}
            label={field.label}
            value={value}
            href={value && field.href ? field.href(value) : undefined}
          />
        );
      })}
    </dl>
  );
}
