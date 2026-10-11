# Facebook sign-in: finish the setup (about 30 minutes)

**What is already built:** the "Continue with Facebook" button, the sign-in code, friendly error messages, the 18+ confirmation for new players, the data deletion page Meta requires (`/data-deletion.html`), and a 1024x1024 app icon (`web/public/icon-1024.png`).

**What only you can do:** create the app in your own Meta account and paste its keys into Supabase. Nobody else can do this for you, and I cannot test it from here. Meta changes its dashboard now and then, so if a label differs slightly, look for the closest match.

You need first:
* Your website address, for example `https://bingo-arena-tan.vercel.app`
* Your Supabase callback address: Supabase → **Authentication → Sign In / Providers → Facebook**, copy the **Callback URL**. It looks like `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
* Your Privacy page `https://YOUR-SITE/privacy.html` and Terms page `https://YOUR-SITE/terms.html` filled in (see `docs/LEGAL_CHECKLIST.md`)

## 1. Create the app
1. Go to **developers.facebook.com**, log in with your Facebook account, and choose **My Apps → Create App**.
2. App name: `Bingo Arena`. Contact email: yours.
3. When asked what you want to do, choose **Authenticate and request data from users with Facebook Login**.
4. If it asks about a business, you can choose to skip connecting one for now. Finish creating the app.

## 2. Allow email and your return address
1. In the app dashboard open **Use cases → Authenticate and request data from users with Facebook Login → Customize**.
2. Under **Permissions**, make sure **public_profile** and **email** are added.
3. Open the Facebook Login **Settings**. In **Valid OAuth Redirect URIs** paste your **Supabase callback address** (exactly as copied). Keep **Client OAuth Login** and **Web OAuth Login** on. Save.

## 3. Fill in the app settings
Open **App settings → Basic**:
* Copy the **App ID**. Press **Show** beside **App secret** and copy it. Never share the secret or put it in the website code. It belongs only in Supabase.
* **App domains:** your website's domain, for example `bingo-arena-tan.vercel.app`.
* **Privacy Policy URL:** `https://YOUR-SITE/privacy.html`. **Terms of Service URL:** `https://YOUR-SITE/terms.html`.
* **User data deletion:** choose **Data deletion instructions URL** and enter `https://YOUR-SITE/data-deletion.html`.
* **App icon (1024 x 1024):** upload `web/public/icon-1024.png` from the project.
* **Category:** Games.
Save changes.

## 4. Connect it to Supabase
Supabase → **Authentication → Sign In / Providers → Facebook**: switch it **on**, paste the **App ID** and **App Secret**, and **Save**.
Then, in the same Authentication area, make sure your website address is in **URL Configuration → Redirect URLs** (see `docs/SOCIAL_LOGIN_GUIDE.md`, Part 1).
If you see a setting called **Allow users without an email**, switch it on. Some Facebook accounts only have a phone number and would otherwise be refused.

## 5. Go live
At the top of the Meta dashboard the app starts in **Development** mode, where only you and people you add under **App roles → Roles** (as Testers) can sign in.
1. Test with yourself first.
2. When it works, switch **App mode** to **Live**. Meta asks you to confirm the privacy policy, the data-deletion address, the icon and the category. Basic sign-in with name and email does not need Meta's app review.

## 6. Test it
- [ ] Open the game in a private window and press **Continue with Facebook**.
- [ ] Facebook asks for permission. Allow it. You return to the game on the "Welcome" screen.
- [ ] Tick the 18+ box, press Continue, and you reach the lobby with your starting coins.
- [ ] Log out and use **Continue with Facebook** again. You should be signed straight in to the same account.

## If something goes wrong
| What you see | Fix |
|---|---|
| "URL blocked: this redirect failed because the redirect URI is not whitelisted" | The Supabase callback address is missing or different in **Valid OAuth Redirect URIs** (step 2). Paste it exactly. |
| "The domain of this URL isn't included in the app's domains" | Add your website domain under **App domains** (step 3). |
| "App not active" or "App is in development mode" | Switch the app to **Live**, or add the person as a Tester (step 5). |
| The game says Facebook did not share an email | The account has no email, or email access was refused. Switch on **Allow users without an email** in Supabase, or tell the player to allow email access or register with email. |
| You come back to the login screen, not signed in | Your website address is missing from Supabase **Redirect URLs**. |
| "This sign-in method is not switched on yet" | The Facebook provider switch in Supabase is off, or the App ID and Secret were not saved. |

## Good to know
* The same person using Google and Facebook with the same verified email is normally linked to one account by Supabase.
* For the iPhone app (later) Apple requires **Sign in with Apple** whenever other social logins are offered.
* If you change your website address, update it in Meta (App domains), Supabase (Redirect URLs) and Google.
