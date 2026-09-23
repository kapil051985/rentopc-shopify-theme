import test from "node:test";
import assert from "node:assert/strict";
import { ShopifyClient, throwOnUserErrors, ShopifyGraphQLError } from "../client.js";
import { ClientCredentialsProvider } from "../auth.js";
import { makeFakeFetch } from "./helpers.js";

function provider(fetch: ReturnType<typeof makeFakeFetch>["fetch"]) {
  return new ClientCredentialsProvider("id", "secret", "kvkvw7-dg.myshopify.com", fetch);
}

test("client retries once on 401 by re-authenticating, then succeeds", async () => {
  const { fetch, calls } = makeFakeFetch([
    // 1) token exchange
    { json: { access_token: "tok-1", expires_in: 86400 } },
    // 2) graphql -> 401 (auth failure)
    { status: 401, text: "unauthorized" },
    // 3) re-exchange after invalidate
    { json: { access_token: "tok-2", expires_in: 86400 } },
    // 4) graphql -> success
    { json: { data: { ok: true } } },
  ]);
  const client = new ShopifyClient({ provider: provider(fetch), fetchImpl: fetch });
  const data = await client.request<{ ok: boolean }>("query { ok }");
  assert.deepEqual(data, { ok: true });
  // Final graphql call used the refreshed token.
  const lastGraphql = calls[calls.length - 1];
  assert.equal(lastGraphql.headers["x-shopify-access-token"], "tok-2");
});

test("client throws on GraphQL errors and never fabricates data", async () => {
  const { fetch } = makeFakeFetch([
    { json: { access_token: "tok-1", expires_in: 86400 } },
    { json: { errors: [{ message: "Field 'bogus' doesn't exist" }] } },
  ]);
  const client = new ShopifyClient({ provider: provider(fetch), fetchImpl: fetch });
  await assert.rejects(() => client.request("query { bogus }"), ShopifyGraphQLError);
});

test("throwOnUserErrors throws when userErrors present", () => {
  assert.throws(
    () => throwOnUserErrors({ userErrors: [{ field: ["title"], message: "bad" }] }),
    ShopifyGraphQLError
  );
});

test("throwOnUserErrors also checks mediaUserErrors", () => {
  assert.throws(
    () => throwOnUserErrors({ mediaUserErrors: [{ message: "media error" }] }),
    ShopifyGraphQLError
  );
});

test("throwOnUserErrors is a no-op when there are no errors", () => {
  assert.doesNotThrow(() => throwOnUserErrors({ userErrors: [], product: { id: "x" } }));
});
