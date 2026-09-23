import test from "node:test";
import assert from "node:assert/strict";
import { buildHarness } from "./harness.js";

test("zod: update_variant_price requires id and price", () => {
  const h = buildHarness([]);
  assert.throws(() => h.validate("update_variant_price", {}));
  assert.throws(() => h.validate("update_variant_price", { id: "gid://x" }));
  // Valid parse succeeds.
  const parsed = h.validate("update_variant_price", { id: "gid://x", price: "9.99" }) as {
    dryRun: boolean;
  };
  assert.equal(parsed.dryRun, false, "dryRun should default to false");
});

test("zod: set_inventory_quantity requires integer quantity", () => {
  const h = buildHarness([]);
  assert.throws(
    () => h.validate("set_inventory_quantity", { inventoryItemId: "a", locationId: "b", quantity: 1.5 }),
    //
  );
  const parsed = h.validate("set_inventory_quantity", {
    inventoryItemId: "a", locationId: "b", quantity: 5,
  }) as { enforceCompare: boolean; reason: string };
  assert.equal(parsed.enforceCompare, true, "enforceCompare defaults to true");
  assert.equal(parsed.reason, "correction");
});

test("zod: add_product_media rejects a bad URL and bad content type", () => {
  const h = buildHarness([]);
  assert.throws(
    () => h.validate("add_product_media", { productId: "p", originalSource: "not-a-url", mediaContentType: "IMAGE" }),
    //
  );
  assert.throws(
    () => h.validate("add_product_media", { productId: "p", originalSource: "https://x/y.png", mediaContentType: "GIF" }),
    //
  );
});

test("zod: delete_media requires an explicit mediaType (no blanket delete)", () => {
  const h = buildHarness([]);
  // Missing mediaType must fail — there is no default 'delete everything'.
  assert.throws(() => h.validate("delete_media", { productId: "p", mediaIds: ["m1"] }));
  // Only 'video' or 'image' are accepted.
  assert.throws(
    () => h.validate("delete_media", { productId: "p", mediaType: "all", mediaIds: ["m1"] }),
    //
  );
  assert.doesNotThrow(() =>
    h.validate("delete_media", { productId: "p", mediaType: "video", mediaIds: ["m1"] })
  );
});
