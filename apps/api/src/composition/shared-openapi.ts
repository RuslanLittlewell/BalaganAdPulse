import { MODULES } from "@adpulse/access-policy";
import { ref, type OperationDoc, type RouteGroupDoc } from "#shared/presentation/openapi.js";
import { mountPath } from "./create-routes.js";
import { SHARED_READS, sharedPath, type SharedRead } from "./shared-routes.js";

const SHARED_FAILURES = [404, 429];
const SESSION_FAILURES = new Set([401, 403]);

const openingDoc: OperationDoc = {
  method: "get",
  path: "/",
  summary: "Open a share link: the shared project and the modules its page uses",
  open: true,
  success: {
    status: 200,
    description: "The shared project and the modules whose figures the shared page shows",
    schema: { type: "object", properties: { project: ref("Project"), modules: { type: "array", items: { type: "string", enum: [...MODULES] } } }, required: ["project", "modules"] },
  },
  errors: SHARED_FAILURES,
};

function sharedOperation(groups: readonly RouteGroupDoc[], read: SharedRead): OperationDoc {
  const mount = mountPath(read.source);
  const source = groups
    .filter((group) => group.mount === mount)
    .flatMap((group) => group.operations)
    .find((operation) => operation.method === "get" && operation.path === read.path);
  if (!source) throw new Error(`No operation describes GET ${mount}${read.path}, which a share link serves`);
  const errors = new Set([...(source.errors ?? []).filter((status) => !SESSION_FAILURES.has(status)), ...SHARED_FAILURES]);
  return { ...source, path: sharedPath(read), open: true, errors: [...errors].sort((a, b) => a - b) };
}

export function sharedReadDoc(groups: readonly RouteGroupDoc[]): RouteGroupDoc {
  return {
    mount: mountPath("shared"),
    tag: "Shared reads",
    tagDescription:
      "The reads a project's share link serves without a session, each the same as its counterpart for members but confined to the shared project. Any other request under a link, of any method, answers 404, as does every request under a link that was replaced or switched off.",
    operations: [openingDoc, ...SHARED_READS.map((read) => sharedOperation(groups, read))],
  };
}
