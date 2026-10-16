## REMOVED Requirements

### Requirement: CRM board reach is enforced independently of task reach
**Reason**: CRM boards are project boards, so their reach now follows project reach.
**Migration**: Replaced by "CRM board reach follows project reach".

## ADDED Requirements

### Requirement: CRM board reach follows project reach
Every CRM request SHALL require an active membership. A CRM board is a project's board, and a member SHALL reach it exactly when they reach the project: ADMIN SHALL reach every project board in their organization; MANAGER and GUEST SHALL reach the boards of projects they hold a grant for, either naming that project or covering its whole client; CLIENT and CLIENT_ADMIN SHALL reach only the boards of their own client's projects. Board enumeration, lead queries, mutations, audit and realtime delivery SHALL enforce these same boundaries. Missing or unreachable board and lead identifiers SHALL return 404; missing authentication SHALL return 401. A customer with no valid client grant SHALL receive no board or leads.

#### Scenario: Project-only employee access
- **WHEN** a manager holds only a grant for project A1 of client A, which also has project A2
- **THEN** project A1's board is in their selector, project A2's is not, and a direct request for A2's board returns 404

#### Scenario: Whole-client employee access
- **WHEN** a manager holds a grant covering the whole of client A
- **THEN** the boards of every project of client A are in their selector

#### Scenario: Customer attempts another client's board
- **WHEN** a customer supplies another client's project board or lead id
- **THEN** the API returns 404 and exposes no lead data

#### Scenario: Staff share a project's leads
- **WHEN** two active managers who reach project A open its board
- **THEN** both see all of project A's leads regardless of who created them

#### Scenario: Guest writes
- **WHEN** a guest attempts a CRM mutation on a board they can read
- **THEN** the API returns 403 and no change occurs

#### Scenario: Organization boundary
- **WHEN** an admin requests a lead or board in another organization
- **THEN** the API returns 404
