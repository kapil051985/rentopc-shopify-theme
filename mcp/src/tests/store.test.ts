import test from "node:test";
import assert from "node:assert/strict";
import { assertStoreGuard, StoreGuardError, lockedStore } from "../store.js";
import { LOCKED_STORE_DOMAIN, normalizeDomain } from "../config.js";

test("locked store is kvkvw7-dg.myshopify.com", () => {
  assert.equal(LOCKED_STORE_DOMAIN, "kvkvw7-dg.myshopify.com");
  assert.equal(lockedStore(), "kvkvw7-dg.myshopify.com");
});

test("guard accepts omitted store (implicit locked store)", () => {
  assert.equal(assertStoreGuard(undefined), LOCKED_STORE_DOMAIN);
  assert.equal(assertStoreGuard(null), LOCKED_STORE_DOMAIN);
  assert.equal(assertStoreGuard(""), LOCKED_STORE_DOMAIN);
});

test("guard accepts the exact locked store, including with scheme/path", () => {
  assert.equal(assertStoreGuard("kvkvw7-dg.myshopify.com"), LOCKED_STORE_DOMAIN);
  assert.equal(assertStoreGuard("https://kvkvw7-dg.myshopify.com/admin"), LOCKED_STORE_DOMAIN);
  assert.equal(assertStoreGuard("KVKVW7-DG.MYSHOPIFY.COM"), LOCKED_STORE_DOMAIN);
});

test("guard REJECTS any other store", () => {
  assert.throws(() => assertStoreGuard("evil.myshopify.com"), StoreGuardError);
  assert.throws(() => assertStoreGuard("kvkvw7-dg.myshopify.com.evil.com"), StoreGuardError);
  assert.throws(() => assertStoreGuard("another-store.myshopify.com"), StoreGuardError);
});

test("normalizeDomain strips scheme, path, and lowercases", () => {
  assert.equal(normalizeDomain("HTTPS://Foo.MyShopify.com/x/y"), "foo.myshopify.com");
});
