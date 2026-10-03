# Turning the website into Android and iPhone apps (Phase 6 preview)

The website is already built for this:
* One layout that adapts: phone (bottom menu), tablet, desktop (left sidebar) and phone sideways (board beside the controls).
* Safe-area spacing for notches and home bars, large tap targets, no accidental zoom or text selection on the board.
* An installable web app (manifest and icons): on a phone, open the site in the browser and choose **Add to Home screen**.
* `web/capacitor.config.json` is ready. Capacitor wraps the same website in a native app, so there is one code base for web, Android and iOS.

## When we do Phase 6 you will need
1. An **Apple Developer** account ($99 a year) and a **Google Play Console** account ($25 once).
2. A Mac for the final iPhone build and upload (or a cloud build service such as Codemagic).
3. App icons, screenshots, a privacy policy and the store forms. I will prepare them with you.

Apple and Google both have rules for apps that involve contests and prizes. The app will stay play-money until you have legal advice and licences for your target countries.
