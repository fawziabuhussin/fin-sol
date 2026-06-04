# Fin$ol — App Store (iOS) Guide

This repo includes a **Capacitor iOS shell** that loads your live Fin$ol web app from Vercel. The native project lives in `ios/`.

**Bundle ID:** `com.finsol.app`  
**Production URL:** `https://fin-sol-pied.vercel.app`

---

## Prerequisites (one-time)

1. **Mac** with **Xcode 15+** (App Store)
2. **Apple Developer Program** — [developer.apple.com](https://developer.apple.com) ($99/year)
3. **Node.js 20+** and **CocoaPods**: `sudo gem install cocoapods`
4. Deploy the latest web app to Vercel (legal pages `/privacy`, `/terms`, `/support` must be live)

---

## Part A — Run in Xcode (first time)

### Step 1 — Install dependencies
```bash
cd /path/to/fin-sol
npm install
```

### Step 2 — Sync Capacitor iOS project
```bash
npm run cap:sync
npm run generate:ios-icons
npm run cap:sync
```

### Step 3 — Open in Xcode
```bash
npm run cap:ios
```
This opens `ios/App/App.xcworkspace`.

### Step 4 — Signing in Xcode
1. Select **App** target in the left sidebar  
2. **Signing & Capabilities** tab  
3. **Team** → your Apple Developer team  
4. **Bundle Identifier** → `com.finsol.app` (must match App Store Connect)  
5. Enable **Automatically manage signing**

### Step 5 — Run on your iPhone
1. Connect iPhone via USB (or use Simulator)  
2. Select your device in the top toolbar  
3. Press **▶ Run** (Cmd+R)  
4. Log in with your Fin$ol account and test: dashboard, transactions, salary PDF upload

### Step 6 — Local dev URL (optional)
To point the app at localhost during development:
```bash
CAPACITOR_SERVER_URL=http://YOUR_MAC_IP:3000 npm run cap:sync
npm run cap:ios
```
Run `npm run dev` on your Mac. Use your Mac's LAN IP, not `localhost`.

---

## Part B — App Store Connect setup

### Step 7 — Create the app listing
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)  
2. **My Apps** → **+** → **New App**  
3. **Platform:** iOS  
4. **Name:** Fin$ol  
5. **Primary language:** Arabic (or English)  
6. **Bundle ID:** `com.finsol.app`  
7. **SKU:** `finsol-ios-001`

### Step 8 — Required URLs (already on your site)
| Field | URL |
|-------|-----|
| Privacy Policy | `https://fin-sol-pied.vercel.app/privacy` |
| Terms of Use | `https://fin-sol-pied.vercel.app/terms` |
| Support URL | `https://fin-sol-pied.vercel.app/support` |
| Marketing URL | `https://fin-sol-pied.vercel.app` |

### Step 9 — App Store metadata
Fill in App Store Connect:

- **Subtitle:** المالية الذكية  
- **Description:** Arabic + English description of income, expenses, savings, salary tracking  
- **Category:** Finance  
- **Keywords:** finance, budget, salary, arabic, savings  
- **Screenshots:** iPhone 6.7" and 6.5" (required) — capture from Simulator or device  
- **Age rating:** complete questionnaire (typically 4+)  
- **App Privacy:** declare email, financial info, user content (transactions you enter)

### Step 10 — Demo account for Apple Review
In **App Review Information**, provide:

- **Email:** a test account email  
- **Password:** test password  
- **Notes:** "Arabic RTL finance app. Login required. Test user has sample transactions."

Apple **will reject** apps they cannot log into.

---

## Part C — Upload build and submit

### Step 11 — Archive in Xcode
1. Select **Any iOS Device (arm64)** as destination (not Simulator)  
2. **Product** → **Archive**  
3. When Organizer opens → **Distribute App**  
4. **App Store Connect** → **Upload**  
5. Wait for processing (15–60 min)

### Step 12 — TestFlight (recommended)
1. App Store Connect → your app → **TestFlight**  
2. Add **Internal Testing** group  
3. Install **TestFlight** on iPhone and test the build  
4. Fix any WebView/login issues before public review

### Step 13 — Submit for review
1. App Store Connect → **App Store** tab → version **1.0**  
2. Select the uploaded build  
3. **Export compliance:** No (standard HTTPS only)  
4. **Submit for Review**

Review usually takes **1–3 days**.

### Step 14 — Release
After approval, choose **Release manually** or **Automatically**.

---

## Updating the app

| Change | Action |
|--------|--------|
| Web features only (Vercel deploy) | No new App Store build needed |
| Native shell, icons, permissions | `npm run cap:sync` → Archive → upload new build |
| Bump version | Xcode → General → **Version** / **Build** |

---

## Quick command reference

```bash
npm install
npm run cap:sync
npm run generate:ios-icons
npm run cap:ios
npm run cap:run
```
