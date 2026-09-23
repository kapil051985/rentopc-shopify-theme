/**
 * Runtime store guard.
 *
 * Every tool that touches Shopify calls assertStoreGuard() with any
 * caller-supplied store value (if the tool accepts one at all). The guard
 * rejects anything that is not the locked store, so a tool call can never
 * bypass the lock defined in config.ts.
 */
import { LOCKED_STORE_DOMAIN, normalizeDomain } from "./config.js";

export class StoreGuardError extends Error {
  constructor(supplied: string) {
    super(
      `Store guard rejected "${supplied}". This MCP only operates against ` +
        `${LOCKED_STORE_DOMAIN}. Cross-store operations are not allowed.`
    );
    this.name = "StoreGuardError";
  }
}

/**
 * If a caller supplies a store/shop value, it MUST equal the locked store.
 * Callers that omit the value implicitly target the locked store.
 */
export function assertStoreGuard(suppliedStore?: string | null): string {
  if (suppliedStore != null && suppliedStore !== "") {
    if (normalizeDomain(suppliedStore) !== LOCKED_STORE_DOMAIN) {
      throw new StoreGuardError(suppliedStore);
    }
  }
  return LOCKED_STORE_DOMAIN;
}

export function lockedStore(): string {
  return LOCKED_STORE_DOMAIN;
}
