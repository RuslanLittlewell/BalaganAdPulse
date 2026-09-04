import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CenteredPanel, Loader } from "@/shared/ui/index.js";
import { http, type ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { ClientRegistrationForm } from "./ClientRegistrationForm.js";
import { EmployeeRegistrationForm } from "./EmployeeRegistrationForm.js";
import { JoinClientForm } from "./JoinClientForm.js";

interface Resolved {
  registrationType: "CLIENT" | "EMPLOYEE" | "CLIENT_STAFF";
}

/**
 * The form an invitation calls for.
 *
 * Which one is the invitation's answer, not the visitor's: the code decides, and
 * the endpoint that resolves it says nothing else about the agency. Unknown,
 * revoked, used and expired come back identically, so this shows one message for
 * all four rather than explaining which.
 */
export function RegistrationPage() {
  const { code = "" } = useParams<{ code: string }>();
  const resolved = useQuery<Resolved, ApiError>({
    queryKey: ["registration", code],
    queryFn: () => http.get<Resolved>(`/regustration/${code}`, { authenticated: false }),
    retry: false,
  });

  if (resolved.isPending) return <CenteredPanel title={t("registration.title")}><Loader /></CenteredPanel>;

  if (resolved.isError) {
    return (
      <CenteredPanel title={t("registration.invalid.title")}>
        <p className="text-sm text-muted-foreground">{t("registration.invalid.description")}</p>
        <Link to="/login" className="mt-4 inline-block text-sm underline">{t("auth.login.submit")}</Link>
      </CenteredPanel>
    );
  }

  const type = resolved.data.registrationType;
  // Only the client's own registration is two columns; the other two are one.
  const wide = type === "CLIENT";
  const title = type === "CLIENT"
    ? t("registration.client.title")
    : type === "CLIENT_STAFF"
      ? t("registration.join.title")
      : t("registration.employee.title");

  return (
    <CenteredPanel title={title} wide={wide}>
      {type === "CLIENT" ? <ClientRegistrationForm code={code} /> : null}
      {type === "CLIENT_STAFF" ? <JoinClientForm code={code} /> : null}
      {type === "EMPLOYEE" ? <EmployeeRegistrationForm code={code} /> : null}
    </CenteredPanel>
  );
}
