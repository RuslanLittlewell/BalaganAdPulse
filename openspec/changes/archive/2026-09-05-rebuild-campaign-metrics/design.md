## Context

The design (`AdPulse Кампании`) draws four screens over one hierarchy:

- **Dashboard** — agency totals, a project table with sparklines, source health.
- **Projects** — the list, and a project's detail.
- **Project** — project totals and a campaign table of fifteen columns plus a
  totals row.
- **Campaign** — campaign totals, a spend/conversions chart by day, and ad sets
  that expand into their ads.

Every number on all four is the same six measured figures, summed at a different
level, with ratios derived from them. `ProjectPriority` already carries exactly
the four priorities the design shows, and `Project` already has `niche`,
`monthlyBudget` and `priority` — the design was drawn against this schema.

## Goals / Non-Goals

**Goals**

- One shape for every project's numbers.
- The levels the platforms actually report at.
- Totals that cannot disagree with the ratios drawn beside them.

**Non-Goals**

- **Ingestion.** Nothing here talks to Meta, Google or Yandex. This change
  defines the shape the figures land in and reads what is there; a later change
  fills them.
- Editing figures by hand. They are measurements, not entries.
- Preserving the sheet's data. Stated plainly in the proposal.

## Decisions

### Store the six measured figures; derive the six ratios

Spend, impressions, reach, clicks, conversions and revenue are stored. CTR, CPC,
CPM, CPA, ROAS and frequency are computed on read.

A stored ratio is a second source of truth for something already recorded, and
the two drift the moment a figure is corrected. Worse, a stored ratio cannot be
re-summed: the CTR of a week is not the average of seven daily CTRs, it is the
week's clicks over the week's impressions. Deriving makes the right answer the
only one available.

A ratio with a zero divisor is **absent**, not zero. A campaign that spent money
and got no clicks has no cost per click — reporting `0 ₽` would read as free.

### One row per entity per day, replaced rather than appended

Platforms restate a day's figures as attribution settles, so the same date
arrives repeatedly with different numbers. The unique key is (entity, date) and
a repeat replaces. Appending would silently double a day's spend the first time
a sync ran twice.

### Metrics at all three levels, not only at the ad

Rolling a campaign up from its ads would be wrong: platforms report figures at
the campaign level that no ad carries — reach in particular is deduplicated
across the campaign's audience, so summing ad-level reach overcounts the people
who saw more than one ad. Each level stores what the platform reports for that
level, and a level is never derived from the one below.

A project and the agency *are* summed from campaigns, because those are our own
groupings and the platform has no opinion about them.

### Reach is inherited downward, and checked before anything else

An ad set or ad is reachable exactly when its campaign is. The check runs before
the entity is looked up, so an unreachable ad and a nonexistent one are
indistinguishable — the same rule the rest of the API follows, for the same
reason: a 403 would confirm the thing exists.

### One `campaign` resource in the permission matrix

`property`, `record` and `value` leave. The hierarchy is one thing a member can
read or not; splitting it into three resources described the old sheet's
internals rather than anything a role has an opinion about.

## Risks / Trade-offs

- **The sheet's data is gone.** Three campaigns, five rows and eight values in
  development at the time of writing. No export step; a database snapshot before
  the migration is the only way back.
- **The screens have nothing to show until ingestion lands.** The structure
  reads what is there, and until a later change fills it, what is there is
  nothing. Seeding a demo project is the obvious way to see the screens working
  before the platforms are connected.
- **Ad-level reach is stored but rarely reported** by some platforms; where it
  is absent the figure is absent, and frequency at that level is absent with it.

### The sheet and its placeholder campaigns leave together

`channel` is not nullable, and every campaign in the database predates channels:
each was auto-seeded by project creation purely to give the sheet somewhere to
live. There is no truthful channel to backfill them with.

The alternatives were worse. Making `channel` nullable would weaken the model
permanently to accommodate a migration-time problem — every campaign that
actually runs has a channel. Backfilling them to `META` would put a false fact
in the database and show it on a screen.

So they are removed in the same migration that drops the sheet: a campaign now
means something that ran on an ad platform, and these never did. This is why the
drop happens in the first migration rather than the last — the schema cannot be
honest until it has.

## Migration Plan

1. One migration: drop the three sheet tables and the placeholder campaigns,
   extend `campaign`, and add `ad_set`, `ad` and the three metric tables.
2. Move the API and web app onto them.

Rollback restores the code; neither the sheet's rows nor the placeholder
campaigns are restored by it. A database snapshot beforehand is the only way
back to them.

## Open Questions

None. Ingestion is deliberately a separate change.
