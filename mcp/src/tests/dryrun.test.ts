import test from "node:test";
import assert from "node:assert/strict";
import { buildHarness } from "./harness.js";

test("dry-run update_product reads current state but does NOT mutate", async () => {
  const h = buildHarness([
    // read-before-write for product
    { json: { data: { product: { id: "gid://shopify/Product/1", title: "Old" } } } },
  ]);
  const res = await h.call("update_product", {
    id: "gid://shopify/Product/1",
    title: "New Title",
    dryRun: true,
  });
  assert.equal(res.isError, false);
  const data = res.data as { dryRun: boolean; operation: string; wouldChange: { input: { title: string } } };
  assert.equal(data.dryRun, true);
  assert.equal(data.operation, "productUpdate");
  assert.equal(data.wouldChange.input.title, "New Title");
  // Only the OAuth exchange + a single read query were sent; no mutation.
  const mutationCalls = h.calls.filter((c) => typeof c.body === "object" && c.body !== null &&
    /mutation/i.test(String((c.body as { query?: string }).query)));
  assert.equal(mutationCalls.length, 0, "dry-run must not send any mutation");
});

test("dry-run update_variant_price shows from/to without mutating", async () => {
  const h = buildHarness([
    { json: { data: { productVariant: { id: "v1", product: { id: "p1" } } } } }, // resolveProductId
    { json: { data: { productVariant: { id: "v1", price: "10.00", compareAtPrice: null } } } }, // read price
  ]);
  const res = await h.call("update_variant_price", { id: "v1", price: "12.50", dryRun: true });
  assert.equal(res.isError, false);
  const data = res.data as { dryRun: boolean; wouldChange: { from: string; to: string } };
  assert.equal(data.wouldChange.from, "10.00");
  assert.equal(data.wouldChange.to, "12.50");
  const mutationCalls = h.calls.filter((c) => /mutation/i.test(String((c.body as { query?: string })?.query)));
  assert.equal(mutationCalls.length, 0);
});

test("dry-run set_inventory_quantity computes changeFromQuantity without mutating", async () => {
  const h = buildHarness([
    // read current available = 7
    { json: { data: { inventoryItem: { inventoryLevel: { quantities: [{ name: "available", quantity: 7 }] } } } } },
  ]);
  const res = await h.call("set_inventory_quantity", {
    inventoryItemId: "ii", locationId: "loc", quantity: 10, dryRun: true,
  });
  const data = res.data as { wouldChange: { currentAvailable: number; targetQuantity: number; changeFromQuantity: number | null } };
  assert.equal(data.wouldChange.currentAvailable, 7);
  assert.equal(data.wouldChange.targetQuantity, 10);
  assert.equal(data.wouldChange.changeFromQuantity, 7, "enforceCompare default uses read-back as changeFromQuantity");
});
