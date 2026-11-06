# organization-modules Specification

## MODIFIED Requirements

### Requirement: The module set can be changed after creation

The enabled optional modules of an organization SHALL derive from its tariff. The
platform administrator SHALL change them by changing the tariff. A change SHALL apply to
the organization's next request. Removing a module through a tariff change SHALL hide it
without deleting its data; restoring it SHALL restore access to that data unchanged.

#### Scenario: Remove then restore
- **WHEN** Reports is removed from an organization by a tariff change and added again later by another
- **THEN** the organization's earlier reports are available again

## REMOVED Requirements

### Requirement: Existing organizations keep every module

**Reason**: The migration to tariffs replaces it. Existing organizations move to `ENTERPRISE`, which includes every module.
**Migration**: Every organization present at migration time gets tariff `ENTERPRISE`.
