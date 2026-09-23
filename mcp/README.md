# RentOPC Shopify MCP

Production-grade Model Context Protocol server for managing the Shopify store
**`kvkvw7-dg.myshopify.com`** via the Admin GraphQL API **2026-07**.

- TypeScript · Node.js (ESM / NodeNext) · MCP SDK · Zod
- Hard-locked to a single store. Modular, read-before-write, dry-run capable,
  and every write verifies the result against Shopify before reporting success.

> This repository is **MCP-only**. It intentionally contains **no** Shopify theme
> directories (`assets/`, `config/`, `layout/`, `locales/`, `sections/`,
> `snippets/`, `templates/`). Themes are managed through Shopify's API by an
> explicit Theme ID — GitHub files are never treated as the source of truth for a
> Shopify theme.

## Authentication

Preferred: **Shopify Client Credentials Grant** (token auto-obtained, cached in
memory, refreshed ~5 min before its ~24h expiry, concurrent refreshes coalesced,
re-authenticated once after an auth failure). Credentials come only from the
environment:

- `SHOPIFY_STORE_DOMAIN=kvkvw7-dg.myshopify.com`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_API_VERSION=2026-07`

Legacy fallback: `SHOPIFY_ACCESS_TOKEN` (static token, no refresh).

The client ID/secret and access token are **never logged, never returned** by any
tool, and **never committed**. In MCP config, reference the secret as
`${SHOPIFY_CLIENT_SECRET}` — never a literal value.

## Safety model

Every destructive/important write follows: validate (Zod) → store guard → read
current state → compute change → optional `dryRun` → mutate → **re-read and
verify** → only then report success. Shopify `userErrors` are always surfaced;
success is never fabricated.

- **Store lock**: compile-time constant; a tool call cannot retarget another store.
- **Media**: image/video are separated. `delete_product_video` refuses if any id
  is an image; `delete_product_image` refuses videos; `delete_media` requires an
  explicit `mediaType`. There is **no** "delete all media" operation.
- **Inventory (2026-07)**: uses `inventorySetQuantities` with the mandatory
  `changeFromQuantity` (compare-and-swap). The removed `compareQuantity` /
  `ignoreCompareQuantity` fields are not used.
- **Themes**: every op needs an explicit Theme ID; roles (MAIN/UNPUBLISHED/…)
  are surfaced as reported by Shopify; writes read-before-write, take a local
  content fingerprint (a snapshot — **not** a Shopify theme version), then
  re-read to verify. Publishing is disabled unless double-confirmed; nothing is
  auto-published or auto-deleted. Theme file writes require `write_themes` + a
  Shopify exemption; access errors are surfaced honestly.

## Build, test, self-test

```bash
npm ci        # or npm install
npm run build # tsc, must be zero errors
npm test      # unit + behavioral tests (mocked fetch, NO live Shopify calls)
npm run selftest  # boots the server with a fake provider and verifies registration
```

- Tests use a scriptable fake `fetch`; **no test touches the real store**.
- The self-test reports the tool count and that no live Shopify calls occur.

## Tools

75 tools are registered (the 73-name target catalog plus 2 bonus diagnostics
tools, `get_inventory_level` and `get_audit_log`). See `TOOLS.md` for the full
list grouped by category, and which perform writes.

## Running from Kiro

Add to your Kiro MCP config (see the connection block in the project handover /
`TOOLS.md`). The server speaks stdio and requires the environment variables
above. It is portable to another Kiro account/session — only the environment
variables need to be provided there.
