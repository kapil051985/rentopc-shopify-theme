/**
 * Shopify Admin GraphQL client.
 *
 * - Sends every request with the token from the auth provider.
 * - On a 401/403 (auth failure) it invalidates the token and retries ONCE.
 * - Surfaces GraphQL userErrors / top-level errors honestly; never fabricates
 *   success.
 */
import { getApiVersion, LOCKED_STORE_DOMAIN } from "./config.js";
import type { FetchLike, TokenProvider } from "./auth.js";

export class ShopifyGraphQLError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly graphqlErrors?: unknown
  ) {
    super(message);
    this.name = "ShopifyGraphQLError";
  }
}

export interface ShopifyClientOptions {
  provider: TokenProvider;
  store?: string;
  apiVersion?: string;
  fetchImpl?: FetchLike;
}

export class ShopifyClient {
  private readonly provider: TokenProvider;
  private readonly store: string;
  private readonly apiVersion: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: ShopifyClientOptions) {
    this.provider = opts.provider;
    this.store = opts.store ?? LOCKED_STORE_DOMAIN;
    this.apiVersion = opts.apiVersion ?? getApiVersion();
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  get endpoint(): string {
    return `https://${this.store}/admin/api/${this.apiVersion}/graphql.json`;
  }

  /** Execute a GraphQL operation and return `data`. Throws on any error. */
  async request<T = unknown>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.provider.getToken();
      const res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-shopify-access-token": token,
        },
        body: JSON.stringify({ query, variables }),
      });

      if ((res.status === 401 || res.status === 403) && this.provider.canRefresh && attempt === 0) {
        // Auth failure: drop cached token and re-authenticate once.
        this.provider.invalidate();
        lastError = new ShopifyGraphQLError(
          `Authentication failed (HTTP ${res.status}); retrying once.`,
          res.status
        );
        continue;
      }

      const text = await res.text();
      if (!res.ok) {
        throw new ShopifyGraphQLError(
          `Shopify Admin API HTTP ${res.status}: ${truncate(text)}`,
          res.status
        );
      }
      let json: { data?: T; errors?: unknown };
      try {
        json = JSON.parse(text);
      } catch {
        throw new ShopifyGraphQLError(`Non-JSON response: ${truncate(text)}`, res.status);
      }
      if (json.errors) {
        throw new ShopifyGraphQLError(
          `Shopify GraphQL errors: ${truncate(JSON.stringify(json.errors))}`,
          res.status,
          json.errors
        );
      }
      return json.data as T;
    }
    throw lastError instanceof Error
      ? lastError
      : new ShopifyGraphQLError("Shopify authentication failed after retry.");
  }
}

function truncate(s: string, max = 1500): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Collect Shopify userErrors from a mutation payload into a thrown error.
 * Every write tool calls this so it can never report success on userErrors.
 */
export function throwOnUserErrors(
  payload: unknown,
  fields: string[] = ["userErrors", "mediaUserErrors"]
): void {
  if (!payload || typeof payload !== "object") return;
  for (const field of fields) {
    const errs = (payload as Record<string, unknown>)[field];
    if (Array.isArray(errs) && errs.length > 0) {
      throw new ShopifyGraphQLError(
        `Shopify ${field}: ${JSON.stringify(errs)}`,
        undefined,
        errs
      );
    }
  }
}
