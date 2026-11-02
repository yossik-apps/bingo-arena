# How to build a screen

The Lobby is the worked example: `Lobby.tsx`, `Lobby.logic.ts`, `lobby.css`, `Lobby.fixture.ts`, `supabase/tests/lobby.test.ts`. Read those with this page. The rules in `CLAUDE.md` (Parallel work) always apply.

## 1. Start
```bash
git worktree add ../bingo-<screen> -b screen/<screen> redesign/next
```
In the new folder: copy `web/.env.local` from the main checkout, then run `npm ci` and `npm --prefix web ci`. Pick your own harness port, for example `--port 5210`; the playground uses the next one.

## 2. Inventory first
Before coding, list everything the Classic screen has and show it for approval: every element, action, data call, and state. Read the Classic view and the parts of `App.tsx` that feed it. Nothing may be lost. The playground supplies looks only, never its data, rules or simulated players.

## 3. Files
| File | What goes in it |
|---|---|
| `screens/<Name>.tsx` | The screen. Default export, one prop: `{ ctx }`. Starts with a `// Uses: profile, wallet` comment listing the ctx groups it reads |
| `screens/<Name>.logic.ts` | Conditions, wording and numbers, as pure functions with no React, so they can be tested. Copy Classic's conditions and words exactly |
| `screens/<name>.css` | This screen's styles, classes starting `nu-<short>-`. Colours and sizes come from `tokens.css` variables only. The only fixed colours allowed are artwork and ink on it |
| `screens/<Name>.fixture.ts` | Sample data for captures, one state per name |
| `supabase/tests/<name>.test.ts` | Tests for the logic. Picked up automatically |

## 4. Using ctx
- Everything comes through `ctx` (`contract.ts`). A screen does not import `supabase` or call `callFn`. That is what lets fixtures work with no account.
- Spending and rewards always go through a server function behind a ctx action. Never compute a balance, score or reward in a screen.
- Pure helpers in `web/src/lib/` (formatting, `dna.ts`, `time.ts`) are fine to import. Do not import from `web/src/design-e/`.
- `ctx.profile` is null for a visitor; `ctx.visitor` is then set. Check which you have.
- Something missing from ctx? Stop and list it in your PR under "Needs a shared change". Do not edit `App.tsx`, `contract.ts`, `NewShell`, `tokens.css`, `components/` or `tools/`.

## 5. Components
Build from `../components`: Button, Card, Chip, Badge, Sheet, Modal, Tabs, ListRow, EmptyState, Skeleton, ErrorState, Toast, ProgressBar, SectionHeader. See them with `?gallery` on the local dev server. If one does not fit, list it under "Needs a shared change". A small screen-only control is fine in your own CSS, as the Lobby's booster row is.

## 6. States every screen needs
Give each one a fixture state and capture it:
- **Loading:** `Skeleton`, with a label.
- **Empty:** `EmptyState`, or hide the section if the Classic screen hides it. Many features have zero rows on live.
- **Error:** `ErrorState` with retry, or the Classic behaviour if that is to hide it.
- **Visitor, guest, signed in.**
- **New player** and a long-time player.
- **Blocked:** banned, maintenance, paid modes off, not enough coins, play-time limit, where they apply.
- **Live events** where they apply.

## 7. Quality bar
- Works from 360 px with nothing clipped and no sideways scrolling. Long names stay on one line with an ellipsis and a `title`.
- Light, dark and big text. Use `calc(<size> * var(--nu-scale))` tokens, never a fixed font size.
- Tap targets at least 44 px. Every control works by keyboard and has a screen-reader label.
- Respect `prefers-reduced-motion`.
- Add `data-must-see="<name>"` to anything a player must see without scrolling. The harness fails if it is off-screen or under the navigation.
- No rule, price or scoring change. No simulated people.

## 8. Screenshots
```bash
node tools/shots.mjs --screen <name> --fixture player --compare playground,classic,new --port <your port>
```
```bash
node tools/shots.mjs --screen <name> --fixture player --compare new --state empty --port <your port>
```
Use `--widths 360,390`, `--modes light`, `--click "Button text"` and `--out <folder>` as needed. Pictures and `index.html` go to `.pr-screenshots/`. The layout checks must pass, and look at the pictures too: the checks cannot judge appearance.

The Classic column shows the signed-out visitor unless you use a test account. Use `--account zz_test_account` only when told to, never from two chats at once. The harness blocks writes, so signed-in captures only read.

## 9. Finish
1. Add one line to `screens/registry.ts`: `<name>: () => import("./<Name>"),`. Add it only when the screen is finished, because listing it is what lets the Design flag show it to players. `supabase/tests/screens.test.ts` checks the file, fixture and `// Uses:` comment.
2. Rebase on `redesign/next`, then run `npm test` and `npm run build`.
3. Open a PR into `redesign/next` with: the inventory as a checklist, Playground | Classic | New captures, every visual difference with its reason, what was not tested, and "Needs a shared change" if any.
