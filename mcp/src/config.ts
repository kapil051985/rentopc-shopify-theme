/**
 * Static configuration and hard store lock for the RentOPC Shopify MCP.
 *
 * The store domain is a compile-time constant. It is intentionally NOT read
 * from a normal tool argument so that no tool call can retarget the MCP at a
 * different Shopify store.
 */

/** The one and only Shopify store this MCP is permitted to operate against. */
export const LOCKED_STORE_DOMAIN = "kvkvw7-dg.myshopify.com" as const;

/** Default Admin API version; can be overridden by env but defaults to 2026-07. */
export const DEFAULT_API_VERSION = "2026-07" as const;

export function getApiVersion(): string {
  return process.env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION;
}

/**
 * Validate that any configured SHOPIFY_STORE_DOMAIN matches the locked store.
 * Called at startup. Throws if an operator tries to point the MCP elsewhere.
 */
export function assertStoreEnv(): void {
  const configured = process.env.SHOPIFY_STORE_DOMAIN;
  if (configured && normalizeDomain(configured) !== LOCKED_STORE_DOMAIN) {
    throw new Error(
      `Store guard: SHOPIFY_STORE_DOMAIN="${configured}" is not permitted. ` +
        `This MCP is hard-locked to ${LOCKED_STORE_DOMAIN}.`
    );
  }
}

/** Normalize a domain-ish string: strip scheme, path, whitespace, lowercase. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}
