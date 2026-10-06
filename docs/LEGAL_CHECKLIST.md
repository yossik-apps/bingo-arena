# Legal checklist (read this before you invite the public)

I am not a lawyer, and nobody can promise a document will "never cause trouble". What I did is write plain-language Terms and a Privacy Policy that **match what the game really does today**, with the sections regulators and the Google, Facebook, Apple and Google Play review teams look for. Your job is to fill in the blanks, and a lawyer's job is to confirm them for your country.

## 1. Fill in the blanks (15 minutes)
Open `web/public/terms.html` and `web/public/privacy.html` in a text editor and search for `[`. Replace each item:
| Placeholder | What to put |
|---|---|
| [COMPANY LEGAL NAME], [REGISTRATION NUMBER], [FULL ADDRESS] | Your registered business (or your own name and address if you are a sole trader) |
| [SUPPORT EMAIL], [PRIVACY EMAIL] | Real inboxes that you read. They can be the same address |
| [DATE] | The date you publish |
| [REGION] | The Supabase region you chose (for example "Frankfurt, EU") |
| [COUNTRY / STATE], [CITY, COUNTRY] | Governing law and courts, for example Israel and Tel Aviv. A lawyer should choose this |
| [AMOUNT] in the liability section | A lawyer's suggestion |
| [30], [90], [24] in the privacy retention section | Your real retention periods. Change them if you prefer |
Then commit and push as usual. The pages are at `https://YOUR-SITE/terms.html` and `https://YOUR-SITE/privacy.html`.

## 2. What the game already does to support the documents
* **18+ confirmation** with the date and the Terms version, for email, Google and Facebook sign-ups.
* **Re-acceptance:** when you change the Terms, change `TERMS_VERSION` in `web/src/lib/supabase.ts` (for example to `2027-03`) and update the version at the top of both pages. Every player sees "We updated our terms" once before playing.
* **Download my data** and **Delete my account** in each player's Profile (needed for GDPR, Israeli law, Apple and Google Play).
* **Healthy-play tools:** break reminders and a self-set daily time limit.
* Every virtual coin movement is recorded, and every admin action is in the audit log.

## 3. Things that would change the legal picture. Stop and call a lawyer first
* **Real money in or out:** deposits, cash prizes, withdrawals, or coins that can be bought with real money and cashed out. This can turn a skill game into regulated gambling or a payment business in many countries, and needs licences, ID checks and a licensed payment provider.
* **Selling coins or packs for real money:** consumer-protection rules apply, and paid random items are restricted or banned in some countries. (The game never sells random packs.)
* **Advertising, analytics or push notifications:** update the Privacy Policy, add a cookie/consent banner where required, and list the providers.
* **Players under 18:** the game is adults-only. Adding younger players needs parental consent rules and a different design.
* **Selling in new countries:** the EU, UK, California and others have specific notices. A lawyer can add them in an hour.

## 4. Before the store apps (Phase 9)
* Apple and Google ask for the privacy policy URL, a data-safety form, account-deletion support (done), and rules for contests and prizes. Keep it play-money only.
* **Sign in with Apple** is required on iPhone when other social logins are offered.

## 5. A sensible order
1. Fill in the blanks. 2. Pay a lawyer for a one-off review of the two pages (usually a few hundred dollars). 3. Register your business and the database with your privacy authority if your country requires it. 4. Launch as play-money only.
