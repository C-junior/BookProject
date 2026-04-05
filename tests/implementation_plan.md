# Codex — Production Readiness Audit

A comprehensive analysis of what's needed to publish Codex as a complete, running product.

---

## 🟢 What's Working Well

| Area | Status | Details |
|------|--------|---------|
| **Stripe Account** | ✅ Active | Account `acct_1T9CKIRjV64R8pPE` ("Área restrita de Codex") |
| **Products Created** | ✅ 13 products | Subscriptions (Pro, Plus), Skins, E-Book |
| **Prices Configured** | ✅ 14 prices | BRL currency for new products, USD for legacy |
| **Active Subscriptions** | ✅ 6 active | All on the old `price_1T9CQBRjV64R8pPEEHT7Ua1a` (R$19.90/mo) |
| **Payment Intents** | ✅ 7 succeeded | All R$19.90 BRL, 100% success rate |
| **Firebase Auth** | ✅ Configured | Google Sign-In + Email/Password |
| **Firestore Rules** | ✅ Secure | Users can only access own data, Pro fields protected |
| **PWA Configuration** | ✅ Complete | Manifest, service worker, offline support |
| **Vercel Deployment** | ✅ Linked | Project `codex` on Vercel |
| **API Endpoints** | ✅ 3 endpoints | checkout-session, webhook, health |
| **i18n** | ✅ Set up | i18next configured |

---

## 🔴 CRITICAL BLOCKERS (Must Fix Before Launch)

### 1. Build Is Broken — PDF Worker Too Large

> [!CAUTION]
> The production build **fails** due to `pdf.worker-BgryrOlp.mjs` being 2.21MB, exceeding the PWA 2MB precache limit.

**Error from `build_error.log`:**
```
Configure "workbox.maximumFileSizeToCacheInBytes" to change the limit
assets/pdf.worker-BgryrOlp.mjs is 2.21 MB, and won't be precached.
```

**Current config** in `vite.config.ts` line 64 already sets `maximumFileSizeToCacheInBytes: 3 * 1024 * 1024` (3MB), but the error still occurs. This suggests the config isn't being applied correctly, or there's a version mismatch.

**Fix:** Either the workbox config isn't being read (check `vite-plugin-pwa` version compatibility), or add `skipWaiting: true` and move the PDF worker to `runtimeCaching` instead of precaching.

---

### 2. TypeScript Compilation Error

> [!WARNING]
> `tsc -b` reports a missing property in PdfReader.tsx.

```
src/components/reader/PdfReader.tsx(349,18): error TS2741: 
Property 'bookTitle' is missing in type {...} but required in type 'BookmarksPanelProps'.
```

**Fix:** Pass `bookTitle` prop to `BookmarksPanel` in PdfReader at line 349.

---

### 3. Stripe Is in TEST MODE

> [!CAUTION]
> You're using `sk_test_*` keys. All 7 payments are **test payments**, not real charges.

**Evidence:**
- `.env.local` → `STRIPE_SECRET_KEY=sk_test_51T9CKI...`
- Account name says "Área restrita de Codex" (sandbox)
- All payment intents succeeded in test mode

**Before launch, you MUST:**
1. Activate your Stripe account for **live payments** (identity verification, bank account)
2. Generate **live** API keys (`sk_live_*`, `pk_live_*`)
3. Set up a **live** webhook endpoint + secret
4. Update Vercel environment variables with live keys
5. **No code changes needed** — just swap the keys

---

### 4. Hardcoded Price ID & URLs in Checkout API

> [!WARNING]
> `api/create-checkout-session.ts` hardcodes a specific price and domain.

```typescript
// Line 91 — hardcoded price
line_items: [{ price: 'price_1T9CQBRjV64R8pPEEHT7Ua1a', quantity: 1 }],

// Lines 84-93 — hardcoded domain
successUrl = 'https://codex-two-teal.vercel.app/'
cancel_url: 'https://codex-two-teal.vercel.app/',
```

**Issues:**
- Only sells the old Codex Pro monthly (R$19.90). The **new** products (Codex Plus R$14.90/mo, new Pro R$19.90/mo, Skins, E-Book) can never be purchased
- If you move to a custom domain, checkout breaks
- No way to buy skins or e-book individually

**Fix:** Accept `priceId` from the request body and use an environment variable for the base URL.

---

### 5. Missing Webhook Events for New Product Types

The webhook (`api/webhook.ts`) only handles:
- `checkout.session.completed` → sets `isPro: true`
- `customer.subscription.deleted` → sets `isPro: false`

**Missing handlers for:**
- `invoice.payment_failed` → should notify user or pause access
- `customer.subscription.updated` → plan changes (upgrade/downgrade)
- One-time purchases (skins, e-book) — no fulfillment logic exists
- `checkout.session.completed` for non-subscription products needs different logic

---

## 🟡 IMPORTANT ISSUES (Fix Before or Shortly After Launch)

### 6. Duplicate/Legacy Stripe Products

You have **two sets of products** creating confusion:

| Product | NEW (BRL) | OLD (USD) |
|---------|-----------|-----------|
| Codex Pro | `prod_UASo5X6vxlvFF6` (R$19.90/mo) | `prod_U7RIus2ENAkJot` (R$19.90/mo + R$159.90/yr) |
| Skins | 5 new products (R$4.90–R$9.90) | 3 old products ($1.00 each) |
| E-Book | `prod_UAT1ZsvQbXiSoj` (R$14.90) | `prod_U8zKYZzZLFBzTE` ($4.99) |

**Recommendation:** Archive or deactivate the old USD products in Stripe Dashboard to avoid confusion. Decide which price IDs are canonical.

---

### 7. No Stripe Customer Portal

> [!IMPORTANT]
> Users have **no way to manage their subscription** (cancel, update payment method, view invoices).

You need [Stripe Customer Portal](https://dashboard.stripe.com/test/settings/billing/portal):
- Configure it in Stripe Dashboard
- Create an API endpoint `api/create-portal-session.ts`
- Add a "Manage Subscription" button in Settings

---

### 8. Missing `STRIPE_WEBHOOK_SECRET` Verification

Your Vercel deployment needs `STRIPE_WEBHOOK_SECRET` set. Without it, webhook events will all fail with "Webhook secret not configured". 

**Check in Vercel Dashboard → Settings → Environment Variables** that these exist:
- `STRIPE_SECRET_KEY` 
- `STRIPE_WEBHOOK_SECRET`
- `FIREBASE_SERVICE_ACCOUNT` (or individual `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`)
- `VITE_FIREBASE_PROJECT_ID`

---

### 9. No Webhook Endpoint Registered in Stripe

> [!WARNING]
> You need to register your webhook URL in Stripe Dashboard → Developers → Webhooks

**URL to register:** `https://codex-two-teal.vercel.app/api/webhook`

**Events to listen for:**
- `checkout.session.completed`
- `customer.subscription.deleted`
- `customer.subscription.updated`
- `invoice.payment_failed`

---

### 10. `firebase-admin` in Client Dependencies

> [!WARNING]
> `firebase-admin` (server-only SDK) is listed in `package.json` dependencies alongside the client-side Firebase SDK. This adds ~8MB+ to your node_modules and may cause issues.

It's only used in the `/api` serverless functions. In Vercel's architecture, the `api/` functions have access to `node_modules`, so it works, but it's a code smell.

---

### 11. Exposed Secrets in `.env`

> [!CAUTION]
> Your `.env` file contains real Firebase API keys and Supabase keys. While Firebase API keys are somewhat public (they go into client bundles), your Supabase key should be carefully reviewed.

The `.gitignore` does cover `.env`, but ensure:
- The repo was **never** committed with these values in tracked files
- Supabase key is a **publishable/anon** key (confirmed: prefix `sb_publishable_`)
- No server secrets are in client-side env vars

---

## 🟠 NICE TO HAVE (Post-Launch Polish)

### 12. No Error Monitoring / Analytics
- No Sentry, LogRocket, or similar crash reporting
- No usage analytics (beyond Firebase's built-in if enabled)
- Hard to diagnose production issues

### 13. No Terms of Service / Privacy Policy
- Required for Stripe acceptance (especially in Brazil)
- Required for Google OAuth consent screen
- Required for App Store/Play Store if you ever go native

### 14. New Products Not Wired to UI
The Codex Plus subscription, individual skin purchases, and e-book purchase have Stripe products/prices but:
- The `StoreView.tsx` may reference them, but the checkout flow hardcodes the old price
- No purchase button creates a checkout session for skins
- No download/fulfillment after skin or e-book purchase

### 15. No `robots.txt` or `sitemap.xml`
For SEO, you need at minimum a `robots.txt` in the `public/` directory.

### 16. Missing Apple Icons for PWA
PWA `index.html` has `apple-mobile-web-app-capable` but no `<link rel="apple-touch-icon">`.

### 17. Custom Domain
Currently at `codex-two-teal.vercel.app` — not ideal for a production brand. Consider setting up a custom domain.

---

## 📋 STRIPE CONFIGURATION SUMMARY

### Account Status
```
Account ID:    acct_1T9CKIRjV64R8pPE
Display Name:  Área restrita de Codex
Mode:          🟡 TEST MODE (not activated for live payments)
Coupons:       None configured
```

### Products & Prices (Current — BRL)

| Product | Type | Price | Price ID |
|---------|------|-------|----------|
| **Codex Pro** | Subscription/mo | R$19.90 | `price_1TC7tPRjV64R8pPEUAkzpDm9` |
| **Codex Plus** | Subscription/mo | R$14.90 | `price_1TC860RjV64R8pPE4rsoSDyE` |
| **Skin: Samurai** | One-time | R$9.90 | `price_1TC865RjV64R8pPEsR1PBqUU` |
| **Skin: Synthborne** | One-time | R$9.90 | `price_1TC864RjV64R8pPEAHZ96GHf` |
| **Skin: Metal Solid** | One-time | R$9.90 | `price_1TC864RjV64R8pPE66wsVmmJ` |
| **Skin: Sakura** | One-time | R$4.90 | `price_1TC863RjV64R8pPEvTc6zar6` |
| **Skin: Magic** | One-time | R$9.90 | `price_1TC862RjV64R8pPEGvJDakU4` |
| **Chronicles of Synthborne (E-Book)** | One-time | R$14.90 | `price_1TC861RjV64R8pPEjb2U2rDG` |

### Legacy Products (USD — should be archived)

| Product | Price | Price ID |
|---------|-------|----------|
| Codex Pro Monthly | R$19.90 | `price_1T9CQBRjV64R8pPEEHT7Ua1a` ← **This is what checkout hardcodes** |
| Codex Pro Yearly | R$159.90 | `price_1T9CQBRjV64R8pPEN2tHX6XO` |
| Cyberpunk Skin | $1.00 | `price_1TAhMSRjV64R8pPEYUbx0XCf` |
| Midnight Skin | $1.00 | `price_1TAhMSRjV64R8pPEVDJqw3Ky` |
| Synthwave Skin | $1.00 | `price_1TAhMTRjV64R8pPEJ3AeIsMc` |
| Chronicles of Synthborne | $4.99 | `price_1TAhMTRjV64R8pPEHSeBNlWv` |

### Subscriptions Status
- **6 active** subscriptions (all test, old price `price_1T9CQBRjV64R8pPEEHT7Ua1a`)
- **1 canceled** subscription
- **7 succeeded** payment intents (all R$19.90 BRL test)

---

## 🚀 LAUNCH CHECKLIST (Priority Order)

### Phase 1: Build Fix (30 min)
- [ ] Fix TypeScript error in `PdfReader.tsx` (add `bookTitle` prop)
- [ ] Fix PWA workbox config for PDF worker (increase limit or exclude from precache)
- [ ] Verify `npm run build` succeeds

### Phase 2: Stripe Production (1–2 hours)
- [ ] Activate Stripe account for live payments (identity + bank)
- [ ] Generate live API keys
- [ ] Create live webhook endpoint in Stripe Dashboard pointing to `https://your-domain.com/api/webhook`
- [ ] Generate live webhook signing secret
- [ ] Update Vercel env vars with live keys

### Phase 3: Checkout Flow Fixes (2–3 hours)
- [ ] Make `priceId` dynamic in `create-checkout-session.ts` (accept from request body)
- [ ] Use environment variable for base URL instead of hardcoding
- [ ] Add support for one-time purchases (skins, e-book) alongside subscriptions
- [ ] Wire up StoreView to pass correct `priceId` for each product

### Phase 4: Webhook Hardening (1–2 hours)
- [ ] Add `invoice.payment_failed` handler
- [ ] Add `customer.subscription.updated` handler
- [ ] Add one-time purchase fulfillment logic (grant skin/e-book access)
- [ ] Register webhook URL in Stripe Dashboard

### Phase 5: User Account Management (2–3 hours)
- [ ] Set up Stripe Customer Portal in Dashboard
- [ ] Create `api/create-portal-session.ts` endpoint
- [ ] Add "Manage Subscription" button in Settings UI

### Phase 6: Legal & Compliance (1 hour)
- [ ] Add Terms of Service page
- [ ] Add Privacy Policy page (required by Stripe, Google OAuth, and Brazilian law — LGPD)

### Phase 7: Production Polish
- [ ] Archive/deactivate legacy USD products in Stripe
- [ ] Add error monitoring (Sentry)
- [ ] Set up custom domain
- [ ] Add `robots.txt` and `sitemap.xml`
- [ ] Add Apple touch icons for PWA

---

## Open Questions

> [!IMPORTANT]
> **1.** Are you planning to use a custom domain, or stay on `codex-two-teal.vercel.app` for launch?

> [!IMPORTANT]
> **2.** For the new products (Codex Plus, individual skins, e-book) — are they ready to sell, or should we only launch with Codex Pro subscriptions for now?

> [!IMPORTANT]
> **3.** Have you already started the Stripe account activation process for live payments? (Identity verification, bank account linking)

> [!IMPORTANT]  
> **4.** The old Codex Pro (`prod_U7RIus2ENAkJot`) has both monthly and **yearly** prices. Should the new Codex Pro also have a yearly option?

> [!IMPORTANT]
> **5.** Do you want me to start fixing the critical blockers (build fix + checkout flow) now, or do you want to review this analysis first?
