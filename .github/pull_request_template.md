## What and why


## Checklist
- [ ] A migration grants exactly what the app needs to `anon` and `authenticated`, or marks it `-- no client access` (see CONTRIBUTING.md)
- [ ] Classic screens are untouched
- [ ] New features and screens sit behind a flag that is Off by default
- [ ] UI changes: screenshots at 360, 390, 430, 1000 and 1440 px in light, dark and big-text modes
- [ ] No secrets committed (keys, tokens, passwords, `.env` files)
- [ ] `npm test` and `npm run build` pass
