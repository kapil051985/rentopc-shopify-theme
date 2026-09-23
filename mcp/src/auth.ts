/**
 * Shopify authentication providers.
 *
 * Two modes:
 *   - client_credentials: production. Exchanges client_id/client_secret for a
 *     short-lived (~24h) Admin API access token via the OAuth token endpoint,
 *     caches it in memory, refreshes before expiry, coalesces concurrent
 *     refreshes, and re-authenticates once after an auth failure.
 *   - token: legacy static SHOPIFY_ACCESS_TOKEN fallback for backward compat.
 *
 * SECURITY: the client secret and access token are never logged, never
 * returned from status(), and never serialized into tool output.
 */
import { LOCKED_STORE_DOMAIN } from "./config.js";

/** Public, non-sensitive view of the auth state. */
export interface AuthStatus {
  mode: "client_credentials" | "token";
  credentialsConfigured: boolean;
  canRefresh: boolean;
  /** True once a token has been obtained at least once. */
  hasToken: boolean;
  /** ISO timestamp when the cached token expires, if known. */
  expiresAt: string | null;
  /** Seconds until expiry (may be negative if stale), if known. */
  expiresInSeconds: number | null;
}

export interface TokenProvider {
  readonly mode: AuthStatus["mode"];
  readonly canRefresh: boolean;
  /** Get a valid access token, refreshing if necessary. */
  getToken(): Promise<string>;
  /** Force the next getToken() to re-authenticate. */
  invalidate(): void;
  /** Non-sensitive status snapshot. */
  status(): AuthStatus;
}

/** Refresh this many ms before the real expiry to avoid mid-flight expiry. */
const REFRESH_SKEW_MS = 5 * 60 * 1000; // 5 minutes

/** Legacy static token. */
export class StaticTokenProvider implements TokenProvider {
  readonly mode = "token" as const;
  readonly canRefresh = false;
  constructor(private readonly token: string) {}
  async getToken(): Promise<string> {
    return this.token;
  }
  invalidate(): void {
    /* static token cannot be refreshed */
  }
  status(): AuthStatus {
    return {
      mode: this.mode,
      credentialsConfigured: this.token.length > 0,
      canRefresh: false,
      hasToken: this.token.length > 0,
      expiresAt: null,
      expiresInSeconds: null,
    };
  }
}

/** Injectable fetch so tests can run without network. */
export type FetchLike = typeof fetch;

/** Production Client Credentials Grant provider. */
export class ClientCredentialsProvider implements TokenProvider {
  readonly mode = "client_credentials" as const;
  readonly canRefresh = true;

  private token: string | undefined;
  private expiresAtMs = 0;
  /** Coalesces concurrent refreshes into a single in-flight exchange. */
  private inflight: Promise<string> | undefined;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly store: string = LOCKED_STORE_DOMAIN,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly now: () => number = Date.now
  ) {}

  invalidate(): void {
    this.token = undefined;
    this.expiresAtMs = 0;
  }

  async getToken(): Promise<string> {
    // Serve cached token if still comfortably valid.
    if (this.token && this.now() < this.expiresAtMs - REFRESH_SKEW_MS) {
      return this.token;
    }
    // Coalesce concurrent refreshes.
    if (this.inflight) return this.inflight;
    this.inflight = this.exchange().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  private async exchange(): Promise<string> {
    const res = await this.fetchImpl(
      `https://${this.store}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      }
    );
    if (!res.ok) {
      // Do NOT include the body verbatim; it should not contain the secret,
      // but we keep the surface minimal regardless.
      throw new Error(`Shopify OAuth token exchange failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new Error("Shopify OAuth response missing access_token");
    }
    this.token = json.access_token;
    // Client-credentials tokens last ~24h; default defensively if absent.
    const ttl = typeof json.expires_in === "number" ? json.expires_in : 86400;
    this.expiresAtMs = this.now() + ttl * 1000;
    return this.token;
  }

  status(): AuthStatus {
    const expiresInSeconds =
      this.expiresAtMs > 0
        ? Math.round((this.expiresAtMs - this.now()) / 1000)
        : null;
    return {
      mode: this.mode,
      credentialsConfigured:
        this.clientId.length > 0 && this.clientSecret.length > 0,
      canRefresh: true,
      hasToken: Boolean(this.token),
      expiresAt:
        this.expiresAtMs > 0 ? new Date(this.expiresAtMs).toISOString() : null,
      expiresInSeconds,
    };
  }
}

/**
 * Build the provider from the environment.
 * Preference: client credentials > static token > error.
 */
export function providerFromEnv(fetchImpl: FetchLike = fetch): TokenProvider {
  const id = process.env.SHOPIFY_CLIENT_ID;
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (id && secret) {
    return new ClientCredentialsProvider(
      id,
      secret,
      LOCKED_STORE_DOMAIN,
      fetchImpl
    );
  }
  const staticToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (staticToken) {
    return new StaticTokenProvider(staticToken);
  }
  throw new Error(
    "Missing Shopify credentials: set SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET " +
      "(preferred) or SHOPIFY_ACCESS_TOKEN (legacy)."
  );
}
