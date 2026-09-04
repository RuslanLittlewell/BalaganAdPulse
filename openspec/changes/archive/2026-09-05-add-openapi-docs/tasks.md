Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. Converting a schema and building a document

- [x] 1.1 Write the failing tests for the converter: a body schema, a query schema with enums and
      bounds, and a schema whose input transforms.
- [x] 1.2 Write the failing tests for the builder: mount paths joined to operation paths, `:id`
      rewritten to `{id}`, and named components referenced by `$ref`.
- [x] 1.3 Add `shared/presentation/openapi.ts` with the operation types, the Zod conversion and the
      document builder.
- [x] 1.4 Run `npm test` — green.

## 2. Assembling and serving the document

- [x] 2.1 Write the failing test for `GET /api/openapi.json`: 200, JSON, OpenAPI 3.1, unauthenticated.
- [x] 2.2 Write the failing test proving every `$ref` in the document resolves within it.
- [x] 2.3 Write the failing test for the security schemes: applied to a protected operation, absent
      from register, login, refresh, logout and the registration resolver.
- [x] 2.4 Assemble the document in the composition root and mount it ahead of authentication.
- [x] 2.5 Run `npm test` — green.

## 3. Each module describing its own endpoints

- [x] 3.1 Write the failing drift guard: enumerate the routes the composed router mounts and compare
      them, method by method, with the document's paths.
- [x] 3.2 Describe the identity and session endpoints, with the token and profile responses.
- [x] 3.3 Describe the invite endpoints and the registration resolver.
- [x] 3.4 Describe the member endpoints, including the avatar image response.
- [x] 3.5 Describe the client and project endpoints, including the avatar uploads.
- [x] 3.6 Describe the campaign, ad-set, project-metric and summary endpoints.
- [x] 3.7 Describe the task and task-image endpoints.
- [x] 3.8 Describe the audit listing.
- [x] 3.9 Run `npm test` — green, the two sets equal.

## 5. The browsable page

- [x] 5.1 Write the failing tests for `GET /api/docs`: HTML naming `/api/openapi.json`, with and
      without a trailing slash, and one asset served from the app.
- [x] 5.2 Add `swagger-ui-dist`, resolve its directory and serve it under the docs mount.
- [x] 5.3 Run `npm test` — green.

## 6. Withdrawing the documentation

- [x] 6.1 Write the failing tests for `API_DOCS=off`: 404 with the error envelope for both paths,
      and served when the variable is unset.
- [x] 6.2 Read the flag in the shared config and leave the router out when it is off.
- [x] 6.3 Run `npm test` — green.

## 7. Reference

- [x] 7.1 Document both endpoints and `API_DOCS` in the README and `.env.example`.
- [x] 7.2 Run `npm test` and `npm run test:web` — green.
