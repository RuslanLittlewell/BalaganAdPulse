import { z } from "zod";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type JsonSchema = Record<string, unknown>;

export type SchemaDoc = z.ZodType | JsonSchema;

export interface ResponseDoc {
  readonly status: number;
  readonly description: string;
  readonly schema?: SchemaDoc;
  readonly contentType?: string;
}

export interface OperationDoc {
  readonly method: HttpMethod;
  readonly path: string;
  readonly summary: string;
  readonly description?: string;
  readonly open?: boolean;
  readonly query?: z.ZodObject;
  readonly body?: SchemaDoc;
  readonly bodyType?: string;
  readonly bodyRequired?: boolean;
  readonly success: ResponseDoc;
  readonly errors?: readonly number[];
}

export interface RouteGroupDoc {
  readonly mount: string;
  readonly tag: string;
  readonly tagDescription?: string;
  readonly operations: readonly OperationDoc[];
}

export type RouteDoc = Omit<RouteGroupDoc, "mount">;

export type ComponentDocs = Readonly<Record<string, z.ZodType>>;

export function mergeComponents(...records: readonly ComponentDocs[]): ComponentDocs {
  const merged: Record<string, z.ZodType> = {};
  for (const record of records) {
    for (const [name, schema] of Object.entries(record)) {
      if (merged[name]) throw new Error(`Two modules describe a component named ${name}`);
      merged[name] = schema;
    }
  }
  return merged;
}

export interface DocumentInput {
  readonly info: { readonly title: string; readonly version: string; readonly description?: string };
  readonly groups: readonly RouteGroupDoc[];
  readonly components?: ComponentDocs;
}

export interface ParameterObject {
  readonly name: string;
  readonly in: "path" | "query";
  readonly required: boolean;
  readonly schema: JsonSchema;
  readonly description?: string;
}

export interface BodyObject {
  readonly required: boolean;
  readonly content: Record<string, { schema: JsonSchema }>;
}

export interface ResponseObject {
  readonly description: string;
  readonly content?: Record<string, { schema: JsonSchema }>;
}

export interface OperationObject {
  readonly tags: readonly string[];
  readonly operationId: string;
  readonly summary: string;
  readonly description?: string;
  readonly parameters?: readonly ParameterObject[];
  readonly requestBody?: BodyObject;
  readonly responses: Record<string, ResponseObject>;
  readonly security?: readonly Record<string, readonly string[]>[];
}

export type PathObject = Partial<Record<HttpMethod, OperationObject>>;

export interface OpenApiDocument {
  readonly openapi: "3.1.0";
  readonly info: DocumentInput["info"];
  readonly servers: readonly { readonly url: string }[];
  readonly tags: readonly { readonly name: string; readonly description?: string }[];
  readonly security: readonly Record<string, readonly string[]>[];
  readonly paths: Record<string, PathObject>;
  readonly components: {
    readonly schemas: Record<string, JsonSchema>;
    readonly securitySchemes: Record<string, JsonSchema>;
  };
}

const ERROR_DESCRIPTIONS: Readonly<Record<number, string>> = {
  400: "The request failed validation",
  401: "Authentication required",
  403: "The actor's role does not allow this",
  404: "No such record, or none this actor may reach",
  409: "The request conflicts with the current state",
  413: "The upload is larger than the limit",
  429: "Too many attempts; retry after the window",
  503: "Temporarily unavailable",
};

const ERROR_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: { message: { type: "string" }, details: {} },
      required: ["message"],
    },
  },
  required: ["error"],
};

const SECURITY_SCHEMES: Record<string, JsonSchema> = {
  sessionCookie: { type: "apiKey", in: "cookie", name: "adpulse_access" },
  bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
};

export const ref = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` });

export const arrayOf = (items: JsonSchema): JsonSchema => ({ type: "array", items });

export const nullableRef = (name: string): JsonSchema => ({
  anyOf: [ref(name), { type: "null" }],
});

export function toJsonSchema(schema: z.ZodType): JsonSchema {
  const { $schema, ...rest } = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "input",
    unrepresentable: "any",
    reused: "inline",
  }) as JsonSchema & { $schema?: string };
  return rest;
}

const asJsonSchema = (schema: SchemaDoc): JsonSchema =>
  schema instanceof z.ZodType ? toJsonSchema(schema) : schema;

export function openApiPath(mount: string, path: string): string {
  const joined = `${mount}/${path}`.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1");
  return joined.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

const pascal = (segment: string): string =>
  segment
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");

const singular = (segment: string): string =>
  segment.endsWith("s") && !segment.endsWith("ss") ? segment.slice(0, -1) : segment;

export function operationId(method: HttpMethod, path: string): string {
  const segments = path.replace(/^\/api/, "").split("/").filter(Boolean);
  const named = segments.map((segment, index) => {
    if (segment.startsWith("{")) return `By${pascal(segment)}`;
    return pascal(segments[index + 1]?.startsWith("{") ? singular(segment) : segment);
  });
  return `${method}${named.join("")}`;
}

const pathParameters = (path: string): ParameterObject[] =>
  [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));

const queryParameters = (query: z.ZodObject): ParameterObject[] => {
  const converted = toJsonSchema(query);
  const properties = (converted.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((converted.required ?? []) as string[]);
  return Object.entries(properties).map(([name, schema]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema,
  }));
};

const responseOf = ({ description, schema, contentType }: ResponseDoc): ResponseObject =>
  schema === undefined
    ? { description }
    : { description, content: { [contentType ?? "application/json"]: { schema: asJsonSchema(schema) } } };

const responsesOf = (operation: OperationDoc): Record<string, ResponseObject> => {
  const responses: Record<string, ResponseObject> = {
    [String(operation.success.status)]: responseOf(operation.success),
  };
  for (const status of operation.errors ?? []) {
    responses[String(status)] = {
      description: ERROR_DESCRIPTIONS[status] ?? "The request failed",
      content: { "application/json": { schema: ref("Error") } },
    };
  }
  return responses;
};

const operationObject = (operation: OperationDoc, tag: string, path: string): OperationObject => {
  const parameters = [...pathParameters(path), ...(operation.query ? queryParameters(operation.query) : [])];
  return {
    tags: [tag],
    operationId: operationId(operation.method, path),
    summary: operation.summary,
    ...(operation.description ? { description: operation.description } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(operation.body
      ? {
          requestBody: {
            required: operation.bodyRequired ?? true,
            content: { [operation.bodyType ?? "application/json"]: { schema: asJsonSchema(operation.body) } },
          },
        }
      : {}),
    responses: responsesOf(operation),
    ...(operation.open ? { security: [] } : {}),
  };
};

export function buildOpenApiDocument(input: DocumentInput): OpenApiDocument {
  const paths: Record<string, PathObject> = {};
  const tags: { name: string; description?: string }[] = [];
  const identifiers = new Set<string>();

  for (const group of input.groups) {
    const known = tags.find(({ name }) => name === group.tag);
    if (!known) tags.push({ name: group.tag, ...(group.tagDescription ? { description: group.tagDescription } : {}) });
    else if (!known.description && group.tagDescription) known.description = group.tagDescription;

    for (const operation of group.operations) {
      const path = openApiPath(group.mount, operation.path);
      const entry = (paths[path] ??= {});
      if (entry[operation.method]) {
        throw new Error(`Two operations describe ${operation.method} ${path}`);
      }
      const described = operationObject(operation, group.tag, path);
      if (identifiers.has(described.operationId)) {
        throw new Error(`Two operations are named ${described.operationId}`);
      }
      identifiers.add(described.operationId);
      entry[operation.method] = described;
    }
  }

  const schemas: Record<string, JsonSchema> = { Error: ERROR_SCHEMA };
  for (const [name, schema] of Object.entries(input.components ?? {})) {
    schemas[name] = toJsonSchema(schema);
  }

  return {
    openapi: "3.1.0",
    info: input.info,
    servers: [{ url: "/" }],
    tags,
    security: [{ sessionCookie: [] }, { bearerAuth: [] }],
    paths,
    components: { schemas, securitySchemes: SECURITY_SCHEMES },
  };
}
