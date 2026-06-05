# App Store Connect — copy-paste checklist

Run in terminal:

```bash
npm run app-store:copy          # print all fields
npm run app-store:copy -- description
npm run app-store:copy -- keywords
npm run app-store:screenshots   # capture iPhone screenshots
```

---

## Version 1.0 page (Arabic)

| Field | File / command |
|-------|----------------|
| Promotional Text | `npm run app-store:copy -- promotional` |
| Description | `npm run app-store:copy -- description` |
| Keywords | `npm run app-store:copy -- keywords` |
| Support URL | `https://fin-sol-pied.vercel.app/support` |
| Marketing URL | `https://fin-sol-pied.vercel.app` |
| Copyright | `2026 Fawzi Abu Hussin` |
| Version | `1.0` (already set) |

## App Information

| Field | Value |
|-------|--------|
| Privacy Policy URL | `https://fin-sol-pied.vercel.app/privacy` |
| Category | Finance |
| Age Rating | 4+ (complete questionnaire — no violence, gambling, etc.) |
| Content Rights | **No** third-party content → `app-store/compliance/content-rights.txt` |

## App Review

See `app-store/review/demo_account.txt` — **replace [USE YOUR DEMO PASSWORD]** before submit.

## App Privacy

See `app-store/compliance/app-privacy.md`

## Encryption

See `app-store/compliance/encryption.txt` — answer **No** when submitting.

## Screenshots (required)

Minimum **3** screenshots for **iPhone 6.7"** (1290×2796):

```bash
chmod +x scripts/app-store-capture-screenshots.sh
npm run app-store:screenshots
```

Upload from `app-store/screenshots/6.7-inch/`

## Digital Services Act

If shown as **non-trader** → click **Get Started** only if you sell goods/services EU-wide as a business. Personal/free app → usually no change needed.

## App name note

App Store Connect shows **المحاسب الصادق**. Metadata includes **Fin$ol** as brand in description. You can keep either name — be consistent on the icon and listing.
