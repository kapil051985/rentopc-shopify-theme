# RentOPC Shopify MCP

Production-oriented Shopify Admin GraphQL MCP for `kvkvw7-dg.myshopify.com`.

## Authentication

Preferred Client Credentials:
- `SHOPIFY_STORE_DOMAIN=kvkvw7-dg.myshopify.com`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_API_VERSION=2026-07`

Legacy static token fallback: `SHOPIFY_ACCESS_TOKEN`.

Never commit credentials. In Kiro MCP config reference secrets as `${SHOPIFY_CLIENT_SECRET}` rather than literal values.

## Safety

The server is store-locked, uses read-before-write design, requires `dryRun=false` for destructive writes, refreshes Client Credentials tokens on expiry/401/403, and does not auto-publish themes.

## Build

```bash
npm ci
npm run build
npm test
npm run selftest
```

The self-test performs no Shopify API call.

## Important status

The original sandbox implementation was lost before persistence. This repository is a clean-room rebuild/scaffold: the core authentication, store guard, GraphQL client, safety gate, and the 73-name MCP surface are included. Operation-specific handlers beyond the core set must be implemented and tested before using them for live writes.