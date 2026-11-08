# web-request-lifecycle Specification

## Purpose

Keep the web application current while avoiding repeated downloads and requests for data that is already available or belongs to a hidden section.

## Requirements

### Requirement: Task images are reused while editing and previewing

The web client SHALL reuse downloaded image bytes for the same image identifier within the signed-in session while cached. Editing text without changing image identifiers SHALL NOT download those images again. Closing a view SHALL release its object URLs.

#### Scenario: Description text changes
- **WHEN** a member edits the description while the same two attachments remain visible
- **THEN** neither image is downloaded again

#### Scenario: Attachment preview opens
- **WHEN** a member previews an image whose thumbnail is already loaded
- **THEN** the preview reuses the downloaded bytes

### Requirement: Realtime subscribers share a connection

Presence, task, and CRM consumers in one application instance SHALL share one authenticated realtime connection. Removing one consumer SHALL leave other consumers connected. Removing the last consumer SHALL close the connection and cancel retries. Reconnection SHALL preserve each consumer's recovery behavior.

#### Scenario: Task board and presence are active
- **WHEN** the member opens the task board while presence is connected
- **THEN** the client continues using one realtime connection

### Requirement: Data refreshes are bounded and relevant

The client SHALL coalesce bursts of CRM events for the same board, refresh only the datasets identified by scoped events, and retain full refresh behavior for older unscoped events and reconnects. An SEO job completion SHALL refresh each affected dataset once regardless of the number of consumers and SHALL NOT refresh unrelated SEO datasets. Cancelled query reads SHALL propagate cancellation to the underlying HTTP request.

#### Scenario: CRM events arrive in a burst
- **WHEN** several events for a board arrive within one refresh window
- **THEN** the client performs one refresh pass for the affected datasets

#### Scenario: SEO audit completes
- **WHEN** an audit completes while two components consume the site's status
- **THEN** audit results refresh once and traffic and search totals are not refetched

### Requirement: Hidden and completed views stop unnecessary requests

The project documents section SHALL NOT start or poll project overview queries. Active onboarding SHALL retain its one-minute freshness guarantee and refresh after relevant successful mutations. Hidden or completed onboarding SHALL stop periodic refreshes and SHALL NOT refetch after unrelated mutations. Failed optimistic onboarding marks SHALL restore the prior state.

#### Scenario: Documents open directly
- **WHEN** a member opens a project's documents
- **THEN** campaigns, metrics, tasks, integrations, and SEO overview data are not fetched for the hidden overview

#### Scenario: Onboarding is hidden
- **WHEN** a member has hidden onboarding and changes a task
- **THEN** no onboarding read is triggered

### Requirement: Fresh reference data survives component mounts

The client SHALL reuse fresh cached reference data across component mounts for a bounded freshness period. Explicit invalidation after writes SHALL still refresh active consumers.

#### Scenario: A second client list opens
- **WHEN** a component mounts shortly after the client list was read
- **THEN** the cached client list is reused without a new request
