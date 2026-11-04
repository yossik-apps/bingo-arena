- Bingo Arena is live with real players. Never delete, reset or rename their data.
- Work on feature branches and pull requests only. Never push to main.
- Supabase: there is NO staging project; the only hosted project is production. Test SQL in CI (every migration runs in an in-memory Postgres) and locally only if Docker is installed. Wrap every migration in begin; … commit;. Migrations are additive (no DROP, no renames, no deletes); use CREATE OR REPLACE. Show me the SQL before running anything. I run production SQL myself, after a manual backup. Vercel previews use the live database: treat a preview as production, use only the dedicated test accounts, and run no bulk or destructive tests.
- Never use supabase db push (production migrations were pasted by hand). Never use the production service-role key or the database password. Local runs use web/.env.local, which holds only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and is never committed. Never print secret values; env variable names only.
- Every new feature, and the new design itself, sits behind a flag that is OFF by default (states: Off, Admins only, All). If a flag read fails or the table is missing, behave as OFF.
- Coins and gems are granted and spent on the server only (ledger tables), never trusted from the client.
- The server scores every round (start-round / submit-round). The client never decides a score.
- Paying must never change the score or result of a match against another person.
- No simulated people shown as real players. The playground's fake friends, opponents and notices never ship.
- No real payments until I say so.
- Stage 1 is a reskin: zero changes to rules, prices, scoring, data or server behaviour. Its only database changes are 023 (flags) and 024 (grants), each shown to me first and run by me after a backup. The Stage 2 events migration takes the next free number.
- Testing on live is limited to exactly two dedicated test accounts, zz_test_account and zz_test_account_2, with a few rounds each. Never use or change any other player's account or data. A wrong balance is fixed by a correcting ledger row, never by editing or deleting.
- Ask before installing packages, changing CI, or editing Vercel settings.
- Every PR: tests and build pass, screenshots at 360, 390, 430, 1000 and 1440 px in light, dark and big-text modes.
- No merges to main for now. All Stage 1 work collects on the integration branch redesign/next.
- reference/design-e-playground is a backup of the playground. It must never be merged into any branch.

## Parallel work
- Each chat works in its own git worktree and branch, created from redesign/next, and opens PRs into redesign/next.
- Edit only your own screen's files and your own line in NEW_SCREENS.
- Never edit shared files: web/src/newui/tokens.css, web/src/newui/components/*, NewShell, the rest of App.tsx, CLAUDE.md, tools/*. If you need a shared change, stop and list it in your PR under "Needs a shared change".
- Every screen must look like the playground's version of it: Playground | Classic | New captures side by side, with each difference listed and explained.
- Screenshots use fixtures. Use zz_test_account or zz_test_account_2 only when I say so, and never from two chats at once.
- Each worktree uses its own dev-server and harness ports:

  | Folder | Branch | Dev server and harness (--port) | Playground (--playground-port) |
  |---|---|---|---|
  | C:\Users\yfrah\Bingo\bingo-arena | redesign/next and short branches | 5195 | 5196 |
  | C:\Users\yfrah\Bingo\bingo-a | screen/play | 5201 | 5211 |
  | C:\Users\yfrah\Bingo\bingo-b | screen/journey | 5202 | 5212 |
  | C:\Users\yfrah\Bingo\bingo-c | screen/compete | 5203 | 5213 |
  | C:\Users\yfrah\Bingo\bingo-playground | reference/design-e-playground (never merged) | | |
- Before opening a PR: rebase on redesign/next, run tests and build.
- Merging: only the main chat (C:\Users\yfrah\Bingo\bingo-arena) merges, and only when I write "merge #N" in that chat. Never merge because CI is green. Lane chats (A, B, C) never merge, even if gh works for them: they open the PR and report its number.
- A merge goes only into redesign/next, never main or reference/design-e-playground, only after every check passes, and always as a merge commit.

### Screen contract
- App.tsx builds one typed ScreenCtx (web/src/newui/screens/contract.ts) and every new screen receives it as its only prop. It is split into named groups: profile, wallet, rounds, navigation, notices, social, daily, dna, settings, platform, visitor, and the data groups from web/src/lib/screenData.ts: journey, season, quests, album, account, compete, store, shop, history, inbox, refer, match, auth. Each data group makes exactly the Classic screen's queries and calls (supabase/tests/screen-data.test.ts checks this).
- Each screen has its own file, web/src/newui/screens/<Name>.tsx, which starts with a comment listing the groups it uses, for example `// Uses: profile, wallet, rounds`.
- Each screen has its own fixture, web/src/newui/screens/<Name>.fixture.ts, exporting `fixture: ScreenFixture`. It changes the sample data from baseFixture.ts for captures.
- NEW_SCREENS (web/src/newui/screens/registry.ts) has one line per screen: `lobby: () => import("./Lobby"),`. A listed screen shows to players once the Design flag allows it, so add the line only when the screen is finished.
- A screen that needs data or an action missing from ScreenCtx lists it under "Needs a shared change" instead of editing App.tsx or the contract.
- Captures: `node tools/shots.mjs --screen <name> --fixture player --compare playground,classic,new --port <your port>`. The playground runs from its own worktree at ../bingo-playground. Copy web/.env.local into each worktree, and run npm ci in the worktree and its web folder.
