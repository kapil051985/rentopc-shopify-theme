# Header & Navigation v2 — Runtime QA Test Plan

**Instructions:** Execute this checklist on the Shopify Preview theme, in order.
Mark each row **PASS** / **FAIL** / **N/A**. Report any FAIL back to the agent
along with (a) failing row #, (b) screenshot if visual, (c) reproduction steps.

**Preview URL format:** `https://<store>.myshopify.com/?preview_theme_id=<theme_id>`

---

## Section 0 — Automated Harness

| # | Step | Expected |
|---|------|----------|
| 0.1 | Load home page in the preview URL | Page renders, no console errors |
| 0.2 | Open DevTools → Console | Console is clean (no red errors) |
| 0.3 | Paste `/app/memory/HEADER_NAV_V2_QA_HARNESS.js` and press Enter | Table prints with **all rows ✓ PASS** |
| 0.4 | Interact (click nav, hover dropdown, submit search) within the 5-second capture window | `nav_click`, `menu_open`, `menu_close`, `search_query` all fire with count ≥ 1 |

---

## Section 1 — Desktop Visual (1920 / 1440 / 1000 px)

Open Chrome DevTools → Toggle Device Toolbar → set Responsive → cycle widths.

| # | Width | Check | Expected |
|---|-------|-------|----------|
| 1.1 | 1920 | Header height | **60 px** (measure via Elements → Computed) |
| 1.2 | 1920 | Logo height | **40 px** |
| 1.3 | 1920 | Nav row centered | Yes; 5 items visually centered with ~28 px gaps |
| 1.4 | 1920 | Search field width | ~260 px idle |
| 1.5 | 1920 | Focus search field | Width expands to **380 px** with border transition |
| 1.6 | 1920 | Scroll page > 100 px | Header shrinks to **56 px**, logo to **34 px**, search to **220 px**, subtle shadow appears |
| 1.7 | 1440 | Repeat 1.1–1.6 | All same expectations |
| 1.8 | 1000 | Repeat 1.1–1.6 | All same (right above 990 px breakpoint) |
| 1.9 | 1440 | Hover mega-menu item, wait 120 ms | Panel fades in (opacity 0→1, translateY 4px→0) |
| 1.10 | 1440 | Move mouse away | Panel fades out after **200 ms** grace |
| 1.11 | 1440 | Panel width | **480 px** |
| 1.12 | 1440 | Panel columns | **Two columns**, ~32 px gap |
| 1.13 | 1440 | Panel border-radius | **14 px** |
| 1.14 | 1920 | Support link | Visible in top-right utility area |

---

## Section 2 — Desktop Interactive

| # | Action | Expected |
|---|--------|----------|
| 2.1 | Tab through header from URL bar | Order: skip-link → hamburger (if visible) → logo → nav items → search → account → Support → cart |
| 2.2 | First Tab press | Skip-to-content link visible in top-left corner |
| 2.3 | Enter/Space on nav item with dropdown | `<details>` opens; `aria-expanded="true"` |
| 2.4 | Escape while dropdown open | Panel closes; focus returns to trigger `<summary>` |
| 2.5 | Click cart icon | Cart drawer opens (unchanged behaviour) |
| 2.6 | Click account | Navigates to account/login page |
| 2.7 | Click Support | Navigates to `/pages/support` |
| 2.8 | Wishlist Hero heart icon | Appears in `.header__icons` (position may vary based on app config) |
| 2.9 | Click Wishlist heart | Wishlist Hero drawer/modal opens normally |
| 2.10 | Type in search field | Predictive dropdown appears within ~200 ms |
| 2.11 | Sold-out products | Do NOT appear in predictive results |
| 2.12 | Products with `custom.spec_line` metafield | Show spec line under title (once metafield is populated by admin) |
| 2.13 | Type an exact product title | That product appears first in results |

---

## Section 3 — Mobile Visual (390 / 360 px, real iPhone Safari + Android Chrome)

DevTools → Device Toolbar → iPhone 14 (390 px) / Pixel 5 (360 px) — then repeat on **real devices**.

| # | Check | Expected |
|---|-------|----------|
| 3.1 | Header height | **56 px** |
| 3.2 | Header shows: hamburger, logo, search icon, cart | ✓ |
| 3.3 | Legacy inline search bar under header | **NOT visible** (CSS-hidden by Phase 3) |
| 3.4 | Tap hamburger | Drawer slides in from left |
| 3.5 | Drawer contains menu + utility + social + **Support + WhatsApp** | ✓ |
| 3.6 | WhatsApp block position | **Pinned to bottom** of drawer utility area |
| 3.7 | Tap WhatsApp block | Opens `https://wa.me/message/KFS7SMDFXRSVK1` in new tab |
| 3.8 | Tap search icon | **Full-screen overlay** slides/fades in |
| 3.9 | Overlay auto-focuses input | Yes (keyboard raises on iOS after ~60 ms delay) |
| 3.10 | Type query in overlay | Predictive results appear inside overlay |
| 3.11 | Tap close (×) | Overlay closes; focus returns to search-trigger button |
| 3.12 | Press hardware back on Android / Escape on iOS keyboard | Overlay closes cleanly |
| 3.13 | While overlay open, try to scroll page behind | Body scroll is locked (`html/body { overflow: hidden }`) |
| 3.14 | Scroll page > 100 px | Sticky-condense fires; header behaves smoothly |
| 3.15 | On iOS Safari, focus input | Font-size 16 px prevents auto-zoom |

---

## Section 4 — Accessibility

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 4.1 | Skip-to-content works | Tab once from URL bar, press Enter | Focus jumps to `<main>` |
| 4.2 | Focus ring visible on all header controls | Tab through | 2 px blue (`#2563EB`) outline, 2 px offset |
| 4.3 | aria-expanded toggles on dropdown | DevTools → inspect `<summary>` while hover/keyboard | `false` → `true` on open, back to `false` on close |
| 4.4 | aria-controls points to real element | Inspect `<summary aria-controls="...">` | Points to existing `id` (`MegaMenu-Content-N` or `HeaderMenu-MenuList-N`) |
| 4.5 | Cart bubble announces on ATC | VoiceOver (Mac) / NVDA (Win) / TalkBack (Android) | New count announced politely |
| 4.6 | Mobile overlay is a dialog | SR label | Announces "Search, dialog" |
| 4.7 | Escape closes overlay + drawer + dropdown | Keyboard only | All three close cleanly |
| 4.8 | Focus trap in mobile overlay | Tab / Shift+Tab while overlay open | Focus cycles within overlay only |
| 4.9 | No keyboard traps elsewhere | Full page keyboard walk | Every element reachable and exitable |
| 4.10 | Lighthouse Accessibility (mobile) | DevTools → Lighthouse | Score ≥ **95** |

---

## Section 5 — Performance (Lighthouse Mobile)

Run on `/`, `/collections/all`, `/products/<featured>`. DevTools → Lighthouse → Mobile → Performance + Accessibility + Best Practices.

| # | Metric | Target | Notes |
|---|--------|-------:|-------|
| 5.1 | **CLS** (Cumulative Layout Shift) | **≤ 0.02** | Header adds 0 shift; may still be affected by pre-existing hero/carousel |
| 5.2 | **LCP** (Largest Contentful Paint) | ≤ 2.5 s | Unaffected by Header v2 |
| 5.3 | **INP** (Interaction to Next Paint) | ≤ 200 ms | Improved on nav-hover jitter |
| 5.4 | **Accessibility** | ≥ 95 | |
| 5.5 | **Best Practices** | ≥ 95 | |
| 5.6 | **Performance** | ≥ 85 | |
| 5.7 | No new "Reduce unused JavaScript" hit > 5 KB | ✓ | Confirms rop-header.js is small |

---

## Section 6 — Predictive Search Test Queries

Type each query in the desktop search field. Note results and manual verification.

| Query | Expected behaviour |
|-------|---------------------|
| `t480` | Lenovo ThinkPad T480 variants appear; sold-out excluded; spec_line row visible if populated |
| `thinkpad` | Multiple ThinkPad models appear; spec_line rows visible |
| `elitebook` | HP EliteBook models appear |
| `dell 7420` | Dell Latitude 7420 appears at top of list (exact-match re-rank) |
| `laptop under 20000` | Fallback to Shopify's server results — may return generic; spec limitation, no synonym mapping |
| `i5 16gb` | Products matching "i5" or "16gb" in title appear; ideally spec_line row shows RAM detail if metafield populated |

**Console verification during search:**

```js
document.addEventListener('search_query', e => console.log('[QA] search_query →', e.detail.q));
document.addEventListener('search_result_click', e => console.log('[QA] result_click →', e.detail));
```

---

## Section 7 — Integrations Preservation

For each integration, complete the "Confirmation Method" and verify.

| Integration | Confirmation Method | Expected |
|-------------|---------------------|----------|
| **Wishlist Hero** | Click heart icon in header; hover a product card | Drawer / floating widget opens; heart toggles fill state; no JS errors |
| **Cashfree** | Add item, proceed to checkout | Cashfree gateway loads; no theme JS blocks the flow |
| **Air Reviews** | View a product page | Review stars render in title area and review widget below |
| **GoAffPro** | Visit a page with GoAffPro widget (usually referral banner) | Widget renders; console has no GoAffPro errors |
| **WhatsApp** (existing floating widget) | Any page | Floating widget visible; drawer-pinned block also visible on mobile |
| **Customer Accounts** | Click account icon | Login/account page loads |
| **Localization** | Change country/language in selector | Prices/labels update; localization forms in mobile drawer also work |
| **Cart Drawer** | Click cart icon | Drawer opens with cart items |
| **Cart Drawer auto-open** | Add to cart from PDP | Drawer does **NOT** auto-open (Phase 4). Cart bubble count updates. |
| **Predictive Search** | Type in search field | Results appear with new sold-out filter + spec_line + re-rank |
| **App Blocks** | Inspect `<header>` in DOM | Any Shopify app blocks configured in header show inside `.header__icons` |

---

## Section 8 — CustomEvent Analytics Wire-up

Paste in DevTools console **before** interacting with the header:

```js
['nav_click','menu_open','menu_close','cart_click','account_click','support_click',
 'support_click_mobile','whatsapp_expert_click','search_open','search_open_mobile',
 'search_query','search_result_click','atc_success']
.forEach(n => document.addEventListener(n, e => console.log('[EVENT]', n, e.detail)));
```

Then interact and confirm the corresponding event fires:

| Interaction | Expected event |
|-------------|----------------|
| Hover a nav item with dropdown | `menu_open` (then `menu_close` on leave) |
| Click a nav item | `nav_click` |
| Click cart icon | `cart_click` |
| Click account icon | `account_click` |
| Click Support (desktop) | `support_click` |
| Click Support (mobile drawer) | `support_click_mobile` |
| Click WhatsApp block (mobile drawer) | `whatsapp_expert_click` |
| Tap search icon (mobile) | `search_open_mobile` and `search_open` |
| Submit search form | `search_query` with `{ q: "<query>" }` |
| Click a predictive result | `search_result_click` with `{ q, label, href }` |
| Add product to cart | `atc_success` |

**Confirm `window.dataLayer` is NOT populated by any of these** — run `console.log(window.dataLayer)` after all interactions; should be `undefined` or empty (or contain only pre-existing GTM entries unrelated to header).

---

## Section 9 — Sign-off

Once **every** row above is PASS / N/A:

- [ ] Reporter name & date
- [ ] Devices tested (list)
- [ ] Lighthouse scores captured (screenshots attached)
- [ ] Any FAILs → bug-fix required (one commit per issue)
- [ ] If clean → agent creates `header-nav-v2-production` git tag

**Do NOT proceed to production tag until every row is signed off.**
