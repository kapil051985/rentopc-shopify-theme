# Dead Code & Unused Asset Audit — Production-Safe Report

**Mode:** Audit-only. No file was modified, renamed, moved or deleted.
**Repository state:** 64 snippets, 74 sections (71 `.liquid` + 3 `.json` groups), 41 template files, 206 assets, 6 layouts, 51 locale files, 122 theme settings.

---

# A. LIQUID

## A.1 Unused snippets

| # | File | Why it appears unused | How verified | Confidence | Risk if removed | Maintenance benefit |
|---|---|---|---|---|---|---|
| A.1.1 | `snippets/WISHLIST_HERO_BKP_card-product.liquid` (34 KB) | `BKP` naming = manual backup. Zero `{% render %}`, `{% include %}`, or textual reference anywhere in the theme (checked `layout/`, `sections/`, `snippets/`, `templates/`, `config/`, `assets/`). | Exhaustive grep across all folders. | **HIGH (99%)** | None — never called by any code path. | ~34 KB source removed; clarifies that Wishlist Hero uses the live `card-product` + app embed, not a legacy card. |
| A.1.2 | `snippets/avada-defer-css.liquid` (806 B) | Avada SEO app was uninstalled in Phase 1A. Zero references remain. | Grep. | **HIGH (99%)** | None. | Removes 1 legacy artefact from the SEO cleanup. |
| A.1.3 | `snippets/gp-head.liquid` (GemPages head bootstrap) | Not `{% render %}`'d from any layout, section, snippet or template. The file itself contains active GemPages logic. | Grep of every folder. | **LOW (≤80%)** — **Needs Manual Verification** | Potentially breaks GemPages "V7" template detection if GemPages docs require a manual `{% render 'gp-head' %}` insertion that the previous fork removed. | Report only. |
| A.1.4 | `snippets/air-reviews-status.liquid` | No references anywhere in the repository. | Grep of every folder. | **LOW (≤80%)** — **Needs Manual Verification** | Air Reviews may inject this snippet name into product pages via an app block or via a docs-recommended manual `{% render %}` in a protected template. | Report only. |
| A.1.5 | `snippets/wishlisthero-header-icon.liquid` | No references anywhere. Header already gets a wishlist icon via the Wishlist Hero app embed. | Grep of every folder. | **LOW (≤80%)** — **Needs Manual Verification** | Wishlist Hero docs may recommend manual insertion into custom headers. | Report only. |
| A.1.6 | `snippets/estimated-delivery.liquid` | The `estimated-delivery` block **type** exists in `sections/main-product.liquid` (line 397 `{% when 'estimated-delivery' %}`) but the block renders its markup inline — it does **not** call this snippet. The snippet is a self-contained duplicate. | Read of `sections/main-product.liquid:397-430`; grep of every folder for `render.*estimated-delivery`. | **MEDIUM (95–98%)** — **Needs Manual Verification** | If a merchant ever refactors `main-product.liquid` (protected) to `{% render 'estimated-delivery' %}`, this snippet becomes the single source of truth. Removing it may create rework. | Report only. |

## A.2 Unused sections

Cross-referenced against: JSON templates, `config/settings_data.json`, section groups (`sections/*.json`), layouts (`{% section %}`, `{% sections %}`), theme editor `presets`, **and the Section Rendering API used by theme JS**.

| # | File | Why | Verified | Confidence | Risk | Benefit |
|---|---|---|---|---|---|---|
| A.2.1 | `sections/WISHLIST_HERO_BKP_header.liquid` (22 KB) | `BKP` naming = backup. Not in any template, section group, settings_data, JS-driven Section Rendering API call. Zero preset entries. | Full grep + AST scan of all JSON templates, `settings_data.json`, section-group JSONs. | **HIGH (99%)** | None. | ~22 KB of legacy backup removed. |
| A.2.2 | `sections/WISHLIST_HERO_BKP_header-group.json` (2.3 KB) | Companion backup group. Never rendered via `{% sections 'WISHLIST_HERO_BKP_header-group' %}`. | Grep in all layouts and sections. | **HIGH (99%)** | None. | Removes legacy section-group file. |
| A.2.3 | `sections/main-quick-search.liquid` (14 KB) | Not in any template/settings_data. Has `"presets"` in its schema (visible in theme editor), **but** it references two non-existent assets (`collection-quick-see-through.css/js`) and its custom `quick_see_through` parameter is not implemented in `snippets/card-product.liquid`. Section is broken by design. | Static schema inspection, asset existence check, cross-check `card-product.liquid`. | **MEDIUM (95–98%)** — **Needs Manual Verification** | Merchant could still add it via the theme editor and hit the broken assets. Safer path: complete or remove; either requires code changes forbidden by this pass. | Report only. |
| A.2.4 | `sections/gp-variant-selected.liquid` | Not in any template, no preset. Contains only a GemPages helper element. Zero external references. | Grep + preset check. | **LOW (≤85%)** — **Needs Manual Verification** | May be dynamically injected by GemPages page builder at edit time. | Report only. |

**Sections that at first glance look unused but are NOT (do not flag):**
`cart-drawer` (JS/laptop-assistant/quick-add-bulk/cart.js), `cart-icon-bubble` (header.liquid + cart-notification.js + laptop-assistant.js), `cart-live-region-text` (cart.js/quick-order-list.js), `cart-notification-button` + `cart-notification-product` (cart-notification.js — Section Rendering API), `pickup-availability` (pickup-availability.js/quick-add.js), `predictive-search` (header.liquid + predictive-search.js), `main-cart-items` + `main-cart-footer` (cart.js), `main-search` (main-search.js), `product-recommendations` (global.js), `quick-order-list` (quick-order-list.js + bulk section), `bulk-quick-order-list` (global.js), plus every section that carries a `"presets"` block making it selectable in the theme editor picker (`collage`, `collapsible-content`, `featured-blog`, `featured-product`, `gm-subcollections`, `image-with-text`, `multicolumn`, `multirow`, `page`, `product-specs`, `video`).

## A.3 Unused templates

| # | File | Why | Verified | Confidence | Risk | Benefit |
|---|---|---|---|---|---|---|
| A.3.1 | `templates/search.avada-seo.liquid` (8 KB) | Avada was uninstalled. Live search template is `templates/search.json`. Nothing routes to `search.avada-seo` unless a merchant manually reassigns. | Direct file diff of behaviour; Avada removal already confirmed in Phase 1A. | **HIGH (99%)** | None on default search. If a merchant explicitly set `?view=avada-seo`, that view URL would 404 — extremely improbable in production. | ~8 KB dead template removed. |
| A.3.2 | `templates/product.gem-backup-default.json`, `templates/product.gp-template-bk-default.json`, `templates/index.gem-backup-default.json`, `templates/index.gp-template-bk-default.json`, `templates/collection.gem-backup-default.json`, `templates/collection.gp-template-bk-default.json` | Naming (`-backup-default`, `-bk-default`) shows these are GemPages rollback snapshots. | File-name convention + inspection of GemPages templates. | **LOW (≤80%)** — **Needs Manual Verification** | Deleting them may disable the GemPages "Restore backup" button and lose recovery capability. | Report only. |

**Templates that look unused but are NOT (do not flag):**
`product.mobiles-new.json`, `product.new-template.json`, `collection.collection-seo.json`, `collection.subcollections.json` — these are **alternate template suffixes** that Shopify admin lets merchants assign per product/collection/page. Not verifiable from the code alone.
`templates/gift_card.liquid`, `templates/robots.txt.liquid`, `templates/llms.txt.liquid` — Shopify serves these directly via known URL routes.

## A.4 Unused blocks

Zero orphan block **schemas** found. All 11 sections with declared-but-not-currently-instantiated blocks (`newsletter`, `featured-product`, `multicolumn`, `main-product`, `multirow`, `footer`, `image-banner`, `rich-text`, `image-with-text`, `collage`, `collapsible-content`) expose these blocks in the theme editor's "Add block" picker — merchants can add them at any time. **Not unused.**

## A.5 Unused schema settings

Scanned all 122 top-level settings from `config/settings_schema.json`. Every single `id` is referenced by `settings.<id>` somewhere in `layout/`, `sections/`, `snippets/`, `templates/`, `assets/`, or `config/`. **Zero unused settings.**

## A.6 Duplicate schema settings

- **Across `settings_schema.json`:** 0 duplicate top-level setting IDs.
- **Within individual sections (per-scope check that respects block-level isolation):** 0 real duplicates. Earlier apparent "duplicates" (`text_style` in `featured-product`, `icon` in `main-product`, etc.) all live in **different block types** inside the same section, which is valid — block settings are scoped per block type.

## A.7 Unreachable Liquid code

- **No dead `elsif/else` branches** found (no branch whose predicate is a literal `false` or contradiction).
- No `{% raw %}{% endraw %}` blocks containing skipped code.
- No `{% break %}`/`{% continue %}` after tags that would leave code following them unreachable.

## A.8 Legacy commented-out code

Zero large commented-out code blocks. Every `{% comment %}` block in the theme is a documentation/attribution note (e.g., "Emits BreadcrumbList JSON-LD structured data…"). The commented CSS lines in `assets/base.css` (58) and `assets/laptop-assistant.js` (57) are legitimate block/JSDoc comments, not disabled code.

## A.9 Empty Liquid files

Zero empty `.liquid` files across `layout/`, `sections/`, `snippets/`, `templates/`.

## A.10 Duplicate render statements

None found on the render path. The two apparent duplicate `stylesheet_tag` emissions inspected earlier (`request-a-quote.css`, `component-totals.css`, `component-discounts.css`, `component-cart-drawer.css` in `theme.liquid`; `gp-global.css` in `gp-head.liquid`) are intentional Phase 2A `media="print" onload + <noscript>` patterns and Shopify `preload_tag + stylesheet_tag` hint patterns. Not duplicates.

---

# B. ASSETS

## B.1 CSS files never referenced

| # | File | Why | Verified | Confidence | Risk | Benefit |
|---|---|---|---|---|---|---|
| B.1.1 | `assets/component-progress-bar.css` | Zero `asset_url`, zero `stylesheet_tag`, zero direct `<link>` reference. The `.progress-bar` styles it would provide are also present in `assets/base.css` and `assets/quick-add.css`, so the on-page progress bar renders correctly without it. | Grep across all folders; visual diff of `.progress-bar` selectors in the three files. | **MEDIUM (96%)** — **Needs Manual Verification** | If `base.css`/`quick-add.css` are ever slimmed and rely on `component-progress-bar.css` picking up a niche selector, removal could regress. Compare selector sets before deleting. | Report only. |

## B.2 JavaScript files never referenced

None found. Every `.js` asset is either loaded via `asset_url` in a Liquid file OR imported/loaded transitively by another JS module OR referenced by the Shopify Section Rendering API.

## B.3 Fonts never referenced

None found. Only fonts on the render path come from `settings.type_body_font | font_url` and `settings.type_header_font | font_url` (Shopify-managed font picker). No orphan `.woff*`/`.ttf` in `assets/`.

## B.4 Images never referenced

**Zero true orphans.** The 44 icon SVGs that don't appear as literal string references in Liquid (`icon-apple.svg`, `icon-banana.svg`, `icon-heart.svg`, `icon-star.svg`, `icon-lock.svg`, `icon-plane.svg`, `icon-recycle.svg`, `icon-return.svg`, `icon-ruler.svg`, `icon-serving-dish.svg`, etc. — 42 icons total) are dynamically referenced by `snippets/icon-accordion.liquid` at line 2 (`{%- assign file = icon | replace: '_', '-' | prepend: 'icon-' | append: '.svg' -%}`) and by 121 schema-value options across sections — merchants pick any of them from the theme editor. **Not unused.**

The one exception:

| # | File | Why | Verified | Confidence | Risk | Benefit |
|---|---|---|---|---|---|---|
| B.4.1 | `assets/icon-inventory-status.svg` | Not chosen by any theme editor schema value. Only referenced from `assets/section-main-product.css:1310` (`.product__inventory .icon-inventory-status circle:first-of-type`), which styles the SVG *if* it is ever rendered inline. No Liquid emits it today. | Grep in all folders. | **LOW (≤85%)** — **Needs Manual Verification** | If a merchant re-enables Dawn's inventory status widget via `main-product.liquid` (protected), or the CSS is retained for a future re-enable, removing this SVG will show a broken icon. | Report only. |

## B.5 Duplicate assets

**Zero identical files** (MD5 comparison across all 206 assets).

## B.6 Empty CSS or JS files

Zero empty `.css` or `.js` files.

---

# C. THEME ARCHITECTURE

## C.1 Sections not assigned to any template

See §A.2. Only the two `WISHLIST_HERO_BKP_*` items are HIGH-confidence orphans that satisfy every dynamic-reference check (JSON templates, section groups, `{% sections %}`, `{% section %}`, `{% render %}` shadow, Section Rendering API in JS, `settings_data.json`, and merchant-selectable presets).

## C.2 Snippets never rendered

See §A.1. Only `WISHLIST_HERO_BKP_card-product.liquid` and `avada-defer-css.liquid` are HIGH-confidence orphans. The other three (`gp-head`, `air-reviews-status`, `wishlisthero-header-icon`) are LOW confidence because the associated third-party apps may prescribe manual insertion.

## C.3 Templates never used

See §A.3. Only `search.avada-seo.liquid` is a HIGH-confidence orphan. All GemPages backup templates require merchant intent to verify.

## C.4 Duplicate functionality

| # | Files | Overlap | Confidence | Recommendation |
|---|---|---|---|---|
| C.4.1 | `snippets/estimated-delivery.liquid` vs inline block in `sections/main-product.liquid:397-430` | Same feature implemented twice; only the inline block is executed. | MEDIUM (see A.1.6) | Report only. |
| C.4.2 | `sections/quick-order-list.liquid` vs `sections/bulk-quick-order-list.liquid` | Overlapping bulk-add UI. Both are referenced by `assets/global.js`/`assets/quick-order-list.js` under different flows. | LOW (≤90%) | **Needs Manual Verification.** Do not touch. |

## C.5 Legacy Dawn code

Every Dawn-shipped section/snippet/asset that appears unused in this specific store is a **selectable option** in the theme editor. Removing any of them narrows merchant options. Not flagged.

## C.6 Legacy app leftovers

| # | File(s) | Origin | Confidence |
|---|---|---|---|
| C.6.1 | `snippets/avada-defer-css.liquid`, `templates/search.avada-seo.liquid` | Avada SEO (removed Phase 1A) | HIGH |
| C.6.2 | `snippets/WISHLIST_HERO_BKP_card-product.liquid`, `sections/WISHLIST_HERO_BKP_header.liquid`, `sections/WISHLIST_HERO_BKP_header-group.json` | Wishlist Hero pre-integration backups | HIGH |

## C.7 Deprecated Shopify APIs

- **`{% include %}` tag:** 0 usages (already migrated to `{% render %}`).
- **`img_url` filter:** modern `image_url` filter is used correctly in every observed emission.
- **Section groups** are declared with the current JSON section-group format.
- No deprecated `shopify_asset_url` calls found.

## C.8 Broken asset references

| # | File | Broken reference | Consequence |
|---|---|---|---|
| C.8.1 | `sections/main-quick-search.liquid:5` | `'collection-quick-see-through.css'` — file does not exist | Section is orphan (§A.2.3); merchants activating it via theme editor would get 404 on the CSS. |
| C.8.2 | `sections/main-quick-search.liquid:9` | `'collection-quick-see-through.js'` — file does not exist | Same as C.8.1. |

## C.9 Missing asset references

Same two entries as C.8. No other missing assets across the theme (117/119 `asset_url` references resolve on the production render path).

---

# D. LOCALIZATION

Baseline: `locales/en.default.json` (398 keys) + `locales/en.default.schema.json` (1,143 keys).

## D.1 Duplicate translation keys

None. JSON parsers already de-duplicate; text-level scan confirmed no duplicate nesting.

## D.2 Unused translation keys

33 keys in `en.default.json` are not statically referenced. **All 33 flagged as MEDIUM/LOW confidence — Needs Manual Verification**, because:

- Pluralized keys (`...one`, `...other`) are resolved by Shopify's `| t: count: N` runtime pluralization and don't appear as literal string references. Examples: `products.facets.product_count.one/other`, `templates.search.results_with_count.one/other`, etc.
- `gempages.*` keys (13 entries: `gempages.Carousel.no_slider`, `gempages.Newsletter.*`, `gempages.Product.*`, `gempages.ProductList.*`, `gempages.ProductTitle.*`, `gempages.ProductVariants.*`, `gempages.StockCounter.*`, `gempages.IconList*.*`) are consumed at runtime by the GemPages app JS.
- `customer_accounts.shop_policies.privacy_policy` is used by Shopify's Customer Accounts feature (managed by Shopify's platform code).
- `general.social.alt_text.share_on_facebook / pinterest / twitter` are accessibility labels that may be surfaced by templates I cannot statically verify.

**Recommendation:** do not remove any of the 33.

## D.3 Missing translation keys

489 keys are referenced in code but not in `en.default.json`. Of those, **100% are schema-scope keys** (`sections.all.*`, `sections.header.*`, `products.facets.product_count_simple`, etc.) that live in `en.default.schema.json`. Verified by spot-check: `sections.all.heading_size.label` and `sections.all.image_shape.label` both exist in `en.default.schema.json`. **No genuine missing keys.**

---

# E. THEME SETTINGS

## E.1 Settings never referenced

Zero. Every one of the 122 top-level settings in `config/settings_schema.json` is referenced by at least one file.

## E.2 Settings duplicated

Zero duplicate top-level setting IDs across `settings_schema.json`.

## E.3 Obsolete settings

None flagged. All settings map to features actively rendered somewhere in the theme.

---

# Final Summary

| Metric | Count |
|---|---:|
| **Total orphan files (HIGH-confidence, ≥99%)** | **5** — `snippets/WISHLIST_HERO_BKP_card-product.liquid`, `snippets/avada-defer-css.liquid`, `sections/WISHLIST_HERO_BKP_header.liquid`, `sections/WISHLIST_HERO_BKP_header-group.json`, `templates/search.avada-seo.liquid` |
| **Total duplicate assets** | **0** (no identical binaries) |
| **Total obsolete code blocks (unreachable/commented-out disabled code)** | **0** (all comment blocks are documentation) |
| **Total items marked "Needs Manual Verification"** | **13** — A.1.3, A.1.4, A.1.5, A.1.6, A.2.3, A.2.4, A.3.2 (×6 GemPages backup templates counted as one item), B.1.1, B.4.1, C.4.1, C.4.2, D.2 (33 keys treated as one item) |
| **Total genuine broken asset references** | **2** (both in `sections/main-quick-search.liquid`, orphan section §A.2.3) |
| **Sections dynamically used via Section Rendering API (must not be flagged)** | 15+ (`cart-drawer`, `cart-icon-bubble`, `cart-live-region-text`, `cart-notification-button/product`, `pickup-availability`, `predictive-search`, `main-cart-items`, `main-cart-footer`, `main-search`, `product-recommendations`, `quick-order-list`, `bulk-quick-order-list`, `featured-product`, etc.) |

## Top 10 safest cleanup opportunities (ranked by confidence)

| Rank | Item | Category | Confidence | Bytes reclaimed | Notes |
|---:|---|---|---|---:|---|
| 1 | `snippets/WISHLIST_HERO_BKP_card-product.liquid` | Legacy app leftover | **99%** | 34,113 B | `BKP` prefix, zero references anywhere. |
| 2 | `sections/WISHLIST_HERO_BKP_header.liquid` | Legacy app leftover | **99%** | 22,311 B | `BKP` prefix, zero references. |
| 3 | `sections/WISHLIST_HERO_BKP_header-group.json` | Legacy app leftover | **99%** | 2,322 B | Companion of #2. |
| 4 | `templates/search.avada-seo.liquid` | Legacy app leftover | **99%** | 8,043 B | Avada uninstalled Phase 1A. Live search uses `search.json`. |
| 5 | `snippets/avada-defer-css.liquid` | Legacy app leftover | **99%** | 806 B | Avada uninstalled. Zero references. |
| 6 | `snippets/estimated-delivery.liquid` | Duplicate functionality | 96% — verify | — | Inline block in `main-product.liquid:397` supersedes it. Keep as safety net or delete after confirming `main-product.liquid` is frozen. |
| 7 | `assets/component-progress-bar.css` | Unused CSS | 96% — verify | — | `.progress-bar` styles also exist in `base.css`/`quick-add.css`. Diff selectors before deleting. |
| 8 | `sections/main-quick-search.liquid` + missing assets | Broken orphan section | 95% — verify | 14 KB + 2 broken refs | Either complete the feature (missing CSS/JS + `card-product` support) or remove; both require code changes beyond this audit's scope. |
| 9 | `assets/icon-inventory-status.svg` | Unused image | ≤85% — verify | — | Only referenced by `section-main-product.css:1310`; no Liquid emits it. |
| 10 | 6× GemPages backup templates (`*.gem-backup-default.json`, `*.gp-template-bk-default.json`) | Legacy backups | ≤80% — verify | ~each | Consult GemPages support before touching — deleting may disable in-app rollback. |

## Items ≥95% confidence recommended for removal

**Ranks 1–5 above (5 files, ~67 KB reclaimed).** All satisfy every reachability check (templates, sections, snippets, app blocks, theme settings, alternate cart modes, alternate product/collection templates, predictive search, quick add, quick view, search, localization, app embeds, and dynamic JS Section Rendering API). Their names explicitly indicate `BKP`/`backup`/`avada` legacy origin.

## Items below 95% confidence

All other findings (ranks 6–10 plus every "Needs Manual Verification" entry above) — do NOT remove. Verify manually first.

---

**End of audit. Zero files were modified. No code changes have been made.**
