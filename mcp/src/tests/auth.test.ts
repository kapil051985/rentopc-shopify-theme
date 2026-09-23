import test from "node:test";
import assert from "node:assert/strict";
import { ClientCredentialsProvider, StaticTokenProvider } from "../auth.js";
import { makeFakeFetch, makeClock } from "./helpers.js";

test("client credentials: exchanges and caches the token", async () => {
  const { fetch, calls } = makeFakeFetch([
    { json: { access_token: "tok-1", expires_in: 86400 } },
  ]);
  const p = new ClientCredentialsProvider("id", "secret", "kvkvw7-dg.myshopify.com", fetch);
  const a = await p.getToken();
  const b = await p.getToken();
  assert.equal(a, "tok-1");
  assert.equal(b, "tok-1");
  // Only one exchange despite two getToken() calls.
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/admin\/oauth\/access_token$/);
  assert.equal((calls[0].body as Record<string, string>).grant_type, "client_credentials");
});

test("client credentials: refreshes before expiry using the clock", async () => {
  const clock = makeClock();
  const { fetch, calls } = makeFakeFetch([
    { json: { access_token: "tok-1", expires_in: 3600 } }, // 1h
    { json: { access_token: "tok-2", expires_in: 3600 } },
  ]);
  const p = new ClientCredentialsProvider("id", "secret", "kvkvw7-dg.myshopify.com", fetch, clock.now);
  assert.equal(await p.getToken(), "tok-1");
  // Advance to within the 5-minute refresh skew window.
  clock.advance((3600 - 60) * 1000);
  assert.equal(await p.getToken(), "tok-2");
  assert.equal(calls.length, 2);
});

test("client credentials: concurrent getToken() coalesces into one exchange", async () => {
  let resolveExchange!: () => void;
  const gate = new Promise<void>((r) => (resolveExchange = r));
  const fetchImpl = (async () => {
    await gate;
    return {
      ok: true, status: 200,
      async text() { return JSON.stringify({ access_token: "tok-1", expires_in: 86400 }); },
      async json() { return { access_token: "tok-1", expires_in: 86400 }; },
    } as unknown as Response;
  }) as unknown as typeof fetch;

  let exchangeCount = 0;
  const counting = (async (...args: unknown[]) => {
    exchangeCount++;
    // @ts-expect-error passthrough
    return fetchImpl(...args);
  }) as unknown as typeof fetch;

  const p = new ClientCredentialsProvider("id", "secret", "kvkvw7-dg.myshopify.com", counting);
  const p1 = p.getToken();
  const p2 = p.getToken();
  const p3 = p.getToken();
  resolveExchange();
  const [a, b, c] = await Promise.all([p1, p2, p3]);
  assert.equal(a, "tok-1");
  assert.equal(b, "tok-1");
  assert.equal(c, "tok-1");
  assert.equal(exchangeCount, 1, "concurrent refreshes must coalesce into one exchange");
});

test("client credentials: invalidate forces re-exchange", async () => {
  const { fetch, calls } = makeFakeFetch([
    { json: { access_token: "tok-1", expires_in: 86400 } },
    { json: { access_token: "tok-2", expires_in: 86400 } },
  ]);
  const p = new ClientCredentialsProvider("id", "secret", "kvkvw7-dg.myshopify.com", fetch);
  assert.equal(await p.getToken(), "tok-1");
  p.invalidate();
  assert.equal(await p.getToken(), "tok-2");
  assert.equal(calls.length, 2);
});

test("auth status never exposes the secret or token", async () => {
  const { fetch } = makeFakeFetch([{ json: { access_token: "tok-secret", expires_in: 86400 } }]);
  const p = new ClientCredentialsProvider("id", "supersecret", "kvkvw7-dg.myshopify.com", fetch);
  await p.getToken();
  const status = p.status();
  const serialized = JSON.stringify(status);
  assert.ok(!serialized.includes("supersecret"), "secret must not appear in status");
  assert.ok(!serialized.includes("tok-secret"), "token must not appear in status");
  assert.equal(status.mode, "client_credentials");
  assert.equal(status.credentialsConfigured, true);
  assert.equal(status.hasToken, true);
});

test("failed token exchange does not leak body and throws", async () => {
  const { fetch } = makeFakeFetch([{ status: 401, text: "unauthorized client_secret=leak" }]);
  const p = new ClientCredentialsProvider("id", "secret", "kvkvw7-dg.myshopify.com", fetch);
  await assert.rejects(() => p.getToken(), (e: Error) => {
    assert.ok(!e.message.includes("leak"), "error must not include response body");
    assert.match(e.message, /HTTP 401/);
    return true;
  });
});

test("static token provider returns configured token and cannot refresh", async () => {
  const p = new StaticTokenProvider("shpat_static");
  assert.equal(await p.getToken(), "shpat_static");
  assert.equal(p.canRefresh, false);
  assert.equal(p.status().mode, "token");
});
