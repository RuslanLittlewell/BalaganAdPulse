## 1. Permission and data model

- [x] 1.1 Add the `share-link` resource to the matrix in `packages/access-policy`, with every action for ADMIN and none for MANAGER, GUEST, CLIENT and CLIENT_ADMIN
- [x] 1.2 Tests for the `share-link` rows of the matrix
- [x] 1.3 Add the `ProjectShareLink` model with its back-relation on `Project` to `apps/api/prisma/models/projects.prisma`, generate the `project_share_link` migration and apply it to the dev and test databases
- [x] 1.4 Run `npm test` and `npm run test:web`

## 2. API: managing a project's link

- [x] 2.1 Add the `share-links` module: domain, repository port, Prisma repository and use cases to read, issue (create, return the existing one, or renew) and remove a link, checking `share-link` permissions and project reach
- [x] 2.2 Add `GET`, `PUT` and `DELETE /api/projects/:id/share-link` with Zod schemas, wire the module in `composition/wiring` and mount the router with the project routes
- [x] 2.3 Add the OpenAPI entries for the three operations
- [x] 2.4 Tests: creating, reading again, a second create returning the same token, renewing to a new token, removing, MANAGER, GUEST, CLIENT and CLIENT_ADMIN refused with 403, a project of another organization answering 404, cascade on project deletion; run `npm test`

## 3. API: reads through a link

- [x] 3.1 Add the optional `sharedProjectId` to `ActorContext` and make `reachableProjects` and `grantedProjects` confine such an actor to that project
- [x] 3.2 Add the exported `SHARED_READS` list with every read `ProjectOverview` and `CampaignPage` make in preview
- [x] 3.3 Add the `shared` mount before `authentication`: the per-address rate limit, token resolution (unknown token, deleted project and suspended organization answer 404), the allowlist gate, the shared actor, the CRM module gate for stage counts, the sub-router over the existing read routers, the per-token limit on ad previews and the `X-Robots-Tag` header
- [x] 3.4 Answer `GET /api/shared/:token` with the project and its page modules (the always-on modules, plus CRM when the organization has it)
- [x] 3.5 Generate the shared OpenAPI operations from `SHARED_READS`, with no security scheme and 404 and 429, and make the route-enumeration test read the shared routes from the same list
- [x] 3.6 Tests: every entry of `SHARED_READS` answers for the shared project; the ids of another project in the same organization answer 404; every method other than GET answers 404; every GET route of the mounted routers that is not on the list answers 404, among them members, tasks, lead lists and CRM contacts; renewed, removed and unknown tokens answer 404; a suspended organization answers 404; a session cookie of another organization changes nothing; both rate limits answer 429; run `npm test`

## 4. Web: share scope

- [x] 4.1 Add the share scope to `shared/lib`: the HTTP client prefixes paths with `/shared/<token>` and skips token refresh and the login redirect under it, and the path builders produce `/share/<token>` addresses
- [x] 4.2 Make `usePreviewMode` report preview under the scope, and make `useActiveProjectId` and `useActiveCampaignId` read the scope and the shared path
- [x] 4.3 Add an auth context for the scope with no user, no role and the modules from the link, so `useCan` answers false and `useModuleEnabled` follows the link
- [x] 4.4 Tests for the prefixed requests, the absent refresh and redirect, the path builders, the selection hooks and the preview state under the scope; run `npm run test:web`

## 5. Web: the shared page

- [x] 5.1 Add the `/share/:token/*` route before `/*`, outside `RequireAuth`, rendering a `ShareArea` with its own `QueryClient`, the share scope and the auth context
- [x] 5.2 Make `ShareArea` resolve the link and show the dead-link state, or the project's name above `ProjectOverview`, or `CampaignPage` at `/share/:token/campaigns/:campaignId`; set the robots meta tag and the document title
- [x] 5.3 Disable the members, tasks, project list and integrations queries in `ProjectOverview` and `CampaignPage` under the scope, and hide the preview bar there
- [x] 5.4 Add the Russian copy for the shared page and the dead-link state to `ru.ts`
- [x] 5.5 Tests with MSW failing on any request outside `SHARED_READS`: the page shows tiles, tabs and the table; switching an account tab; one account shows no tabs; the CRM columns follow the modules; an SEO tab; opening a campaign and coming back with the same period and tab; no edit controls; the dead-link state; run `npm run test:web`

## 6. Web: sharing from the project header

- [x] 6.1 Add share-link queries and mutations to the project entity
- [x] 6.2 Add the `project-share` feature with the share dialog: create, show the address, copy with a confirmation, replace and switch off, each asking to confirm inside the dialog
- [x] 6.3 Add the `onShare` prop and the «Поделиться» button beside «Превью» to `ProjectHeader`, and open the dialog from `ProjectPage` when `useCan("update", "share-link")` allows it and the page is not in preview
- [x] 6.4 Add the dialog's Russian copy to `ru.ts`
- [x] 6.5 Tests: the button only for ADMIN, not for MANAGER or GUEST, not in preview; creating, copying, replacing and switching off with their confirmations; run `npm run test:web`

## 7. Check and close

- [ ] 7.1 Run the app, create a link, open it in a private window and in a signed-in window of another organization, open a campaign and a creative, renew the link and see the old address go dead
- [x] 7.2 Run `npm test`, `npm run test:web` and `openspec validate project-share-link --strict`
