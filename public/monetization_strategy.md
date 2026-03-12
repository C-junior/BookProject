# Codex — Monetization Roadmap

> Living document outlining revenue streams, feature gating, and implementation priorities.

---

## Phase 1 — Trial & Limits ✅ Done

The foundation is live. Every new user gets a taste of Pro, then hits strategic friction points that drive conversion.

| Feature | Status | How it Works |
| :--- | :---: | :--- |
| 7-Day Pro Trial | ✅ | Auto-granted on signup. Full Pro experience from day one. |
| 3-Book Library Limit | ✅ | Free users can store up to 3 books. The 4th triggers [UpgradePrompt](file:///d:/dev/BookProject/src/components/subscription/UpgradePrompt.tsx#11-57). |
| Stripe Checkout | ✅ | [CheckoutButton](file:///d:/dev/BookProject/src/components/subscription/CheckoutButton.tsx#11-74) → Vercel Serverless → Stripe Checkout Session. |
| PRO Badge | ✅ | Gold badge next to "Codex" title for active Pro subscribers. |
| Trial Banner | ✅ | Shows remaining days ("5 days left") or expired state with inline upgrade CTA. |

---

## Phase 2 — Exclusive Content & Customization (Current Focus)

These are the next revenue drivers. Each one adds a unique reason to go Pro.

---

### 2A. "Chronicles of Synthborne" — Premium Book

The author's own novel, *Chronicles of Synthborne*, is built directly into Codex as a **premium content offering**.

| Scenario | Behavior |
| :--- | :--- |
| **Pro User** | Taps the SYNTHBORNE promo button → book is added to their library **for free** instantly. |
| **Free User** | Taps the button → sees a paywall: *"Chronicles of Synthborne is a Premium book."* with a [CheckoutButton](file:///d:/dev/BookProject/src/components/subscription/CheckoutButton.tsx#11-74) to subscribe or a one-time purchase option. |

**What's already built:**
- [ShareTarget.tsx](file:///d:/dev/BookProject/src/components/ui/ShareTarget.tsx) — Premium book detection (`isPremiumBook`) and Pro-gating logic.
- [LibraryView.tsx](file:///d:/dev/BookProject/src/components/library/LibraryView.tsx#L577-L590) — "SYNTHBORNE — Explore the world behind the book →" promo button linking to the book website.
- EPUB hosted on Supabase: `Chronicles_of_Synthborne.epub`.

**What needs to be done:**
1. Wire the SYNTHBORNE promo button to **add the book directly** (not just link to the website) for Pro users.
2. For free users, show the premium paywall with subscribe/purchase options.
3. Consider a **one-time purchase option** (e.g., $2.99) so free users can buy just the book without committing to Pro.

> [!TIP]
> This is a unique advantage — the app creator is also a published author. The book serves as both content marketing (drives users to the app) and a revenue stream (drives app users to Pro).

---

### 2B. Cloud Sync — Pro Exclusive

Syncing across devices becomes a core Pro benefit. Free users keep their books locally.

| Tier | Capability |
| :--- | :--- |
| **Free** | Local storage only (IndexedDB/Dexie). Books, annotations, and progress stay on-device. |
| **Pro** | Full cloud sync via Firebase. Library, annotations, reading progress, and preferences sync across all devices automatically. |

**What needs to be done:**
1. Gate the existing sync logic in [syncService.ts](file:///d:/dev/BookProject/src/services/sync/syncService.ts) behind a `isPro` check.
2. Show a "Sync is a Pro feature" prompt when a free user tries to access synced data from another device.
3. When a user upgrades mid-session, trigger the first full sync automatically.

> [!IMPORTANT]
> Free users should still be able to **sign in** (for the trial, book limit tracking, etc.). The gate is specifically on the **sync/upload of book files and annotations**, not on authentication itself.

---

### 2C. Theme Store — Two-Layer Customization System

The Theme Store is split into **two distinct layers** — giving users both subtle reading preferences and full app identity transformations.

**Current State:**
- 5 built-in reader themes: Light, Dark, Sepia, Mint, Warm.
- [CustomTheme](file:///d:/dev/BookProject/src/types/index.ts#141-147) type exists in [types/index.ts](file:///d:/dev/BookProject/src/types/index.ts#L141-L146).
- Theme switching via `data-theme` attribute on the HTML root.

---

#### Layer 1: Reader Themes (Reading Page Only)

Color palettes that change the **reading experience** — background, text color, and accent.

| Category | Examples | Access |
| :--- | :--- | :--- |
| **Classic** | Light, Dark, Sepia | Free |
| **Nature** | Mint, Warm, Ocean Blue, Forest, Sunset | Free: Mint & Warm. Rest: Pro. |
| **Aesthetic** | Rose Gold, Nord, Dracula, Solarized | Pro only |
| **Seasonal** | Cherry Blossom (Spring), Midnight Snow (Winter) | Pro only, rotated quarterly |

---

#### Layer 2: App Skins (Full UI Transformation) ⭐ New

Complete visual overhauls that change the **entire face of the app** — not just reading colors, but the library, toolbar, cards, backgrounds, buttons, animations, and overall atmosphere.

**What an App Skin changes:**

| Element | Example (Hogwarts Skin) |
| :--- | :--- |
| **Library Background** | Dark castle stone texture with floating candles |
| **Book Cards** | Parchment-styled with wax seal accents |
| **Buttons & CTAs** | Gold-bordered with magical glow on hover |
| **Typography** | Serif font with a fantasy feel |
| **Toolbar / Header** | Dark wood texture, house-crest accent color |
| **Micro-animations** | Sparkle effects on interactions, page-turn magic dust |
| **Color Palette** | Deep burgundy, gold, dark navy |
| **Icons** | Subtle thematic icon variants (wand → settings, scroll → book) |

**Proposed App Skins:**

| Skin | Vibe | Key Visual Elements |
| :--- | :--- | :--- |
| 🏰 **Hogwarts / Dark Academia** | Magical, scholarly | Stone textures, gold accents, candlelight, parchment cards |
| 🌸 **Anime / Kawaii** | Playful, vibrant | Pastel gradients, rounded elements, bouncy micro-animations |
| 🤖 **Cyberpunk / Neon** | Futuristic, edgy | Neon glows, dark backgrounds, glitch effects, monospace fonts |
| 🌿 **Cottagecore** | Warm, cozy | Linen textures, soft greens, floral accents, hand-drawn borders |
| 🌌 **Sci-Fi / Space** | Cosmic, immersive | Starfield backgrounds, hologram-style cards, blue/purple palette |
| 📜 **Vintage / Retro** | Nostalgic, classic | Sepia tones, typewriter fonts, worn paper textures |
| 🎮 **Pixel / Retro Gaming** | Fun, nostalgic | 8-bit styled elements, pixel fonts, chiptune-inspired borders |
| ☕ **Minimal / Zen** | Clean, distraction-free | Pure whitespace, ultra-thin borders, muted tones |

**Access Model:**

| Tier | What You Get |
| :--- | :--- |
| **Free** | Default Codex skin only |
| **Pro** | All skins unlocked + future skin drops included |

**Implementation Approach:**
1. Each skin = a CSS file with `--skin-*` variables + optional background assets + optional micro-animation overrides.
2. Skin definitions stored in Firestore (`skins` collection): [id](file:///d:/dev/BookProject/src/components/library/BookCard.tsx#32-37), [name](file:///d:/dev/BookProject/src/services/parsers/index.ts#39-58), `category`, `cssVariables`, `backgroundImage`, `isPremium`, `previewScreenshot`.
3. A new **"Theme Store" tab** in Settings or a dedicated page accessible from the library.
4. Skin previews shown as **live screenshots** or **interactive mini-previews** — user sees the library rendered in each skin before applying.
5. Active skin stored in user preferences → applied via `data-skin` attribute on `<html>`.

**Why This Is a Great Idea:**

> [!TIP]
> **Zero marginal cost, high perceived value.** Every skin is just CSS + a few image assets. No backend logic, no API calls, no server cost. But users *perceive* skins as a premium experience worth paying for. Discord proved this with Nitro themes — cosmetic-only features drive massive engagement and retention.

**Stretch Ideas:**
- **Skin Creator** — Pro users build their own skin (pick colors, background, card style) and save it.
- **Community Skins** — Share custom skins. Top-voted get featured in the store.
- **Skin + Reader Theme combos** — Curated pairings (e.g., "Hogwarts Skin + Sepia reader" → "The Full Wizard Experience").

---

## Phase 3 — Future Expansion

These are parked for later but represent strong growth opportunities.

| Feature | Description | Revenue Model |
| :--- | :--- | :--- |
| **Reading Stats & Analytics** | Streaks, reading time charts, genre breakdown. | Free: basic count. Pro: full dashboard. |
| **Text-to-Speech (TTS)** | Browser Speech API for narration. | Free: basic voice. Pro: premium voices + controls. |
| **Advanced PDF Tools** | Margin cropping, dual-page, reflow. | Pro only. |
| **Annotation Export** | Export highlights/notes to Notion, Obsidian, Markdown. | Pro only. |
| **Multi-Cloud Backup** | Sync to Google Drive, Dropbox, OneDrive. | Pro only. |
| **Profile Badges & Avatars** | Visual badges ("Early Adopter", "Power Reader", "Collaborator"). | Earned through engagement or Pro perks. |

---

## Revenue Model Summary

```
┌─────────────────────────────────────────────────────────┐
│                    CODEX REVENUE STREAMS                │
├──────────────────┬──────────────────────────────────────┤
│ Pro Subscription │ $X/month — Unlocks everything:       │
│                  │ • Unlimited books                    │
│                  │ • Cloud Sync                         │
│                  │ • All premium reader themes          │
│                  │ • All app skins (Hogwarts, Cyber..)  │
│                  │ • Chronicles of Synthborne (free)    │
│                  │ • Future: Stats, TTS, Export         │
├──────────────────┼──────────────────────────────────────┤
│ One-Time Content │ Chronicles of Synthborne: $2.99      │
│                  │ (book only, no Pro required)         │
├──────────────────┼──────────────────────────────────────┤
│ Free Tier        │ 3 books, local only, default skin,   │
│                  │ basic reader themes, 7-day trial.    │
└──────────────────┴──────────────────────────────────────┘
```

---

## Implementation Priority

```mermaid
gantt
    title Codex Monetization Timeline
    dateFormat  YYYY-MM-DD
    section Phase 1 (Done)
    Trial + Limits + Stripe       :done, p1, 2026-03-08, 3d
    section Phase 2 (Current)
    Chronicles of Synthborne Gate :active, p2a, 2026-03-12, 3d
    Cloud Sync Pro Gate           :p2b, after p2a, 3d
    Reader Theme Store MVP        :p2c, after p2b, 3d
    App Skins System              :p2d, after p2c, 5d
    section Phase 3 (Future)
    Reading Stats                 :p3a, after p2d, 5d
    TTS Implementation            :p3b, after p3a, 5d
```
