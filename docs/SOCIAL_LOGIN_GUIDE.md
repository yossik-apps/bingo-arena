# Google and Facebook sign-in: setup guide

The game already contains the buttons and the code. What is missing is the **one-time setup on Google's, Meta's and Supabase's websites**. Only you can do it (it needs your accounts). It takes about 30–45 minutes. Website screens change names from time to time, so if a label differs slightly, look for the closest match.

You will need three things first:
* **Your website address**, for example `https://bingo-arena.vercel.app`
* **Your Supabase callback address**. In Supabase go to **Authentication → Sign In / Providers → Google**. Copy the **Callback URL**. It looks like `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`. It is the same for Facebook.
* Your **Privacy Policy address**: `https://YOUR-SITE/privacy.html`. A template page is included. Fill in the [brackets] and have a lawyer review it.

---
## Part 1. Tell Supabase where your website lives
Supabase → **Authentication → URL Configuration**
* **Site URL:** your website address.
* **Redirect URLs:** add your website address and also `http://localhost:5173` (for testing on your computer). Click **Save**.

## Part 2. Google
1. Go to **console.cloud.google.com** and sign in. Create a **New Project** called `Bingo Arena`.
2. Open **Google Auth Platform** (also called *APIs & Services → OAuth consent screen*) and click **Get started**.
   * App name: `Bingo Arena`. Support email: yours.
   * Audience: **External**.
   * Contact email: yours. Accept the policy and **Create**.
3. In **Branding**, add your website address, and the Privacy Policy and Terms addresses. Under **Authorized domains** add your website's domain (for example `vercel.app` or your own domain). Save.
4. In **Data Access**, make sure only the basic scopes are listed: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. (These need no Google review.)
5. In **Clients**, click **Create client**.
   * Application type: **Web application**. Name: `Bingo Arena web`.
   * **Authorized JavaScript origins:** your website address, and `http://localhost:5173`.
   * **Authorized redirect URIs:** your Supabase callback address (exactly as copied).
   * Click **Create**, then copy the **Client ID** and **Client secret**.
6. In **Audience**, click **Publish app** so anyone can sign in (not only test users).
7. Back in Supabase → **Authentication → Sign In / Providers → Google**: switch it on, paste the **Client ID** and **Client secret**, **Save**.

## Part 3. Facebook
**Use the dedicated guide: `docs/FACEBOOK_LOGIN_GUIDE.md`.** It covers everything below plus the data-deletion page and icon that Meta requires. The short version follows.

1. Go to **developers.facebook.com**, log in, and click **My Apps → Create App**.
2. Choose the use case **Authenticate and request data from users with Facebook Login**. Name the app `Bingo Arena`, add your contact email, and create it.
3. In **App settings → Basic**:
   * Copy the **App ID** and click **Show** next to **App secret** to copy it.
   * Enter your **Privacy Policy URL** and **Terms of Service URL**, an app icon, and a category (for example *Games*). Save.
4. In **Use cases → Authenticate… → Customize** (or *Products → Facebook Login → Settings*):
   * **Valid OAuth Redirect URIs:** paste your Supabase callback address. Save.
   * Make sure the permissions **public_profile** and **email** are included.
5. In Supabase → **Authentication → Sign In / Providers → Facebook**: switch it on, paste the **App ID** and **App Secret**, **Save**.
6. At the top of the Meta dashboard, switch the app from **Development** to **Live** so all players can sign in. (In Development mode only people you add under **App roles** can log in. Add yourself and any testers there to test first.)

## Part 4. Test it
- [ ] Open your website in a private/incognito window.
- [ ] Press **Continue with Google**, choose an account, and you should land back in the game on the "Welcome" screen.
- [ ] Tick the 18+ box and continue. You should see the lobby with your starting coins.
- [ ] Log out and repeat with **Continue with Facebook**.

## If something goes wrong
| What you see | Fix |
|---|---|
| "redirect_uri_mismatch" (Google) | The redirect URI in Google must be **exactly** the Supabase callback address. No extra slash or spaces. |
| "provider is not enabled" in the game | The provider switch in Supabase is off, or the keys were not saved. |
| You return to the login screen without being signed in | Your website address is missing from Supabase → URL Configuration → Redirect URLs. |
| Facebook says the app is not active or not available | The Meta app is still in **Development** mode. Switch it to Live, or add the person under App roles. |
| "Error 400: invalid_request" on Google's screen | The consent screen is incomplete. Finish Branding (support email, privacy policy, authorized domain). |
| A Facebook user has no email | Some Facebook accounts only have a phone number. The game still works because it only needs a name. |

## Good to know
* New Google/Facebook players always see an **18+ confirmation** screen once, before they can play. Their confirmation is saved with the date.
* If the same person signs in with different methods but the same verified email, Supabase normally links them to the same account.
* For the iPhone app (Phase 6) Apple requires **Sign in with Apple** whenever other social logins are offered. We will add it then.
* Never share your **Client secret** or **App secret**. They belong only in Supabase, never in the website code.
