# Switching on ads (Google H5 Games Ads)

The game shows ads only when you switch them on in **Admin → Store → Ads**. Until then, nothing changes for players.

**What players see:**
- **Reward video**, always optional: "Watch a short video · +50 coins". It appears on the Play screen, the store, the Coins screen and the result screen. Default limit: 5 videos per player per day.
- **Break between rounds**, off by default: a short ad when leaving the result screen, every 3 finished rounds. Google also limits how often.

Ads are never shown during a round, to visitors without an account, or to Bingo Club members.

## Step 1: AdSense account (about 15 minutes, then Google reviews it)
1. Go to **adsense.google.com** and sign in with the Google account that should receive the money.
2. Add your site address (your Vercel address or your own domain), and fill in your payment and tax details.
3. Google gives you a **publisher ID** that looks like `ca-pub-1234567890123456`. Keep it.

## Step 2: ads.txt (tells Google the site is yours)
1. In your GitHub folder, create the file `web/public/ads.txt` with this one line, using your own number after `pub-`:
   ```
   google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0
   ```
2. Commit and push. After Vercel is Ready, `https://YOUR-SITE/ads.txt` should show the line.

## Step 3: Ask for games ads
In AdSense, apply for **H5 Games Ads** (Google's ads for web games). Google may ask a few questions about the game. Approval can take some days.

## Step 4: Consent message (required for Europe and the UK)
In AdSense → **Privacy & messaging**, create the European regulations (GDPR) message and publish it. Google then asks players in those countries for consent before personalised ads.

## Step 5: Switch on in the game
1. **Admin → Store → Ads**: paste your publisher ID, keep **Test ads** ticked, tick **Ads on**, and press Save.
2. Open the Play screen (log out and back in, or refresh). You should see "Watch a short video · +50 coins". With test ads, Google shows sample ads that earn nothing.
3. When Google approves the site, untick **Test ads** and save. Real ads start, and the money appears in AdSense.
4. Optional: tick **Short ad between rounds** and choose how often.

## Notes
- Google pays you through AdSense. The amount depends on country, season and how many players watch.
- The game can't prove on the server that a video was really watched, because the ad runs in the browser. That's why rewards are limited per day and spaced at least 20 seconds apart.
- Admin → Store → Ads shows how many reward videos were watched today, in the last 7 days and by place.
