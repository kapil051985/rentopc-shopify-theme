/**
 * Runtime context wiring auth provider + GraphQL client together.
 * Constructed once at startup (or in tests with injected fakes).
 */
import { providerFromEnv, type FetchLike, type TokenProvider } from "./auth.js";
import { ShopifyClient } from "./client.js";
import { getApiVersion, LOCKED_STORE_DOMAIN } from "./config.js";

export interface RuntimeContext {
  provider: TokenProvider;
  client: ShopifyClient;
  store: string;
  apiVersion: string;
}

export function createRuntimeContext(opts?: {
  provider?: TokenProvider;
  fetchImpl?: FetchLike;
}): RuntimeContext {
  const provider = opts?.provider ?? providerFromEnv(opts?.fetchImpl);
  const client = new ShopifyClient({ provider, fetchImpl: opts?.fetchImpl });
  return {
    provider,
    client,
    store: LOCKED_STORE_DOMAIN,
    apiVersion: getApiVersion(),
  };
}
