# Redesign tracker

## Stage 1 decisions
- Store stays in `preview` mode exactly as it is.
- Screen order: shell, Lobby, Play, Result first. Everything else after, each with a solid empty state, because many features have zero rows on live.
- The reskin follows server settings: no Beginner hints, 100-second rounds, shop items with a minimum level.
- Migration 023: `revoke all` on `feature_flags` from `anon` and `authenticated`, then `grant select` to both, because the flag is read before sign-in. Writes only through `admin_set_flag`. Test the grants directly, because CI has no Supabase default grants.

## Launch gates
- [ ] Season change: Season 1 ends on 2026-11-22. Screens must work when the season changes.

## Later, not part of Stage 1
- Harden the broad table grants. 22 tables give `anon` and `authenticated` all privileges, including TRUNCATE: `ad_rewards`, `ad_settings`, `app_links`, `auth_relay`, `auto_log`, `auto_settings`, `club_claims`, `club_members`, `coin_vault`, `event_templates`, `gem_ledger`, `liveop_templates`, `match_invites`, `overtake_log`, `player_marks`, `purchases`, `referral_settings`, `referrals`, `spend_limits`, `store_products`, `store_settings`, `visits`.
