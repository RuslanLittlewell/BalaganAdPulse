## 1. Presence registry

- [x] 1.1 Write failing unit tests for the registry: a touch makes a person present, a
  second touch from another session keeps one entry, silence beyond the window expires
  them, sign-out removes them at once, and a sweep reports who left
- [x] 1.2 Implement the presence registry against an injected clock and window
- [x] 1.3 `npm test` and `npm run test:web` are green

## 2. Presence follows the request path

- [x] 2.1 Write a failing API test that an authenticated request marks its caller
  present and that an unauthenticated one marks nobody
- [x] 2.2 Touch the registry where the request's actor is resolved
- [x] 2.3 Write a failing API test that signing out removes the caller from the roster
- [x] 2.4 Clear the caller's presence on sign-out
- [x] 2.5 `npm test` and `npm run test:web` are green

## 3. Roster scoping and delivery

- [x] 3.1 Write failing tests for scoping: another organization is never disclosed,
  staff see everyone in their organization, and a customer sees staff plus their own
  client's people but nobody else's
- [x] 3.2 Implement the scoped roster read
- [x] 3.3 Write a failing test that a connection receives the roster on connect, a join
  when somebody arrives and a departure when somebody expires or signs out, each
  filtered for that connection
- [x] 3.4 Implement presence delivery over the realtime connection
- [x] 3.5 `npm test` and `npm run test:web` are green

## 4. Composition

- [x] 4.1 Wire the registry, its sweep and the delivery into the container, and stop the
  sweep on shutdown
- [x] 4.2 Write a failing end-to-end API test over a real socket: a second member's
  arrival and departure reach a connected member
- [x] 4.3 `npm test` and `npm run test:web` are green

## 5. Presence on the web

- [x] 5.1 Write failing tests for the shared realtime channel: it delivers messages,
  reconnects after a drop and backs off on repeated failure
- [x] 5.2 Implement the shared realtime channel in `shared/lib`
- [x] 5.3 Write failing tests for the presence entity: the roster arrives on connect,
  a join adds a person, a departure removes them, and the viewer is left out
- [x] 5.4 Implement the presence entity on the shared channel
- [x] 5.5 `npm run test:web` is green

## 6. The header block

- [x] 6.1 Write failing tests: avatars appear between the action buttons and the user
  block, a name is revealed on hover, a surplus is summarized as a count, and nothing is
  rendered when nobody else is online
- [x] 6.2 Implement the online widget and place it in the header, with Russian labels in
  `ru.ts`
- [x] 6.3 Write a failing test that the dashboard heartbeats the session while it is
  mounted
- [x] 6.4 Implement the heartbeat
- [x] 6.5 `npm test` and `npm run test:web` are green

## 7. Close out

- [x] 7.1 `openspec validate add-online-presence --strict` passes and the change is
  archived
