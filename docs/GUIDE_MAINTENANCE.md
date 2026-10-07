# Keeping the player guide up to date

The guide players see (intro tour, Help centre, FAQ, glossary) lives in **one file**: `web/src/guide/content.ts`.

## How players see it
* **New players:** the full tour, once, after they confirm their age. They can skip it or go back.
* **Returning players after an update:** only a short "What is new" tour with the steps added since they last saw the guide.
* **Anyone, any time:** the **?** button in the header (Help) and Profile → "Show the intro tour again" replay everything.
* Progress is remembered per player in the database (migration 007) and on the device.

## Every time a feature is added or changed (this is part of finishing the feature)
1. Open `web/src/guide/content.ts`.
2. **New feature:** add a step to `GUIDE` with `since: <current GUIDE_VERSION + 1>` (the highest `since` is the guide version). Use plain words, 1 to 4 short sentences, an icon name, and `view` if there is a screen to open.
3. **Changed feature:** edit the existing step's text. If players should be told, also add a new step with the new `since` ("What is new").
4. Add or edit a `FAQ` entry if players are likely to ask about it, and a `GLOSSARY` term for any new word.
5. Add a line starting with `- Guide:` to the top entry in `CHANGELOG.md` (or `- Guide: no change`), and bump `"version"` in `web/package.json`.
6. Run `npm test`. It fails if the guide is incomplete, or if the newest CHANGELOG entry has no `- Guide:` line, or its version differs from `web/package.json`.

## Writing style
Short sentences. Everyday words ("tap", "coins"), not game jargon. Say what the player gets, not how it works inside. Test: could someone who has never played a bingo game understand it?
