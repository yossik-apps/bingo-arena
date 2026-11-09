# Redesign tracker

## Stage 1 decisions
- Store stays in `preview` mode exactly as it is.
- Screen order: shell, Lobby, Play, Result first. Everything else after, each with a solid empty state, because many features have zero rows on live.
- The reskin follows server settings: no Beginner hints, 100-second rounds, shop items with a minimum level.
- Migration 023: `revoke all` on `feature_flags` from `anon` and `authenticated`, then `grant select` to both, because the flag is read before sign-in. Writes only through `admin_set_flag`. Test the grants directly, because CI has no Supabase default grants.

## Launch gates
- [ ] Season change: Season 1 ends on 2026-11-22. Screens must work when the season changes.
- [ ] The live game takes about 5 seconds to load. Measure (production vs. the commit before the flag merge) and fix before Design is set to All.

## Later, not part of Stage 1
- Commit the `web/package-lock.json` version sync (0.19.0 to the current version) in a separate small commit.
- Harden the broad table grants. 22 tables give `anon` and `authenticated` all privileges, including TRUNCATE: see the grants migration.
- Help: 'Try it below.' points at nothing (also in Classic).
