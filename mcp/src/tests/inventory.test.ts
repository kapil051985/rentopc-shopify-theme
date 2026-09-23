import test from "node:test";
import assert from "node:assert/strict";
import { buildHarness } from "./harness.js";

function mutationCall(h: ReturnType<typeof buildHarness>) {
  return h.calls.find((c) => /inventorySetQuantities/i.test(String((c.body as { query?: string })?.query)));
}

test("set_inventory_quantity uses changeFromQuantity (compare-and-swap) by default", async () => {
  const h = buildHarness([
    // read current available = 3
    { json: { data: { inventoryItem: { inventoryLevel: { quantities: [{ name: "available", quantity: 3 }] } } } } },
    // mutation success
    { json: { data: { inventorySetQuantities: { inventoryAdjustmentGroup: { id: "adj1" }, userErrors: [] } } } },
    // re-read verification: now 8
    { json: { data: { inventoryItem: { inventoryLevel: { quantities: [{ name: "available", quantity: 8 }] } } } } },
  ]);
  const res = await h.call("set_inventory_quantity", {
    inventoryItemId: "ii", locationId: "loc", quantity: 8,
  });
  assert.equal(res.isError, false, res.rawText);
  const data = res.data as { updated: boolean; verified: boolean; usedChangeFromQuantity: number | null; newAvailable: number };
  assert.equal(data.updated, true);
  assert.equal(data.verified, true);
  assert.equal(data.newAvailable, 8);
  assert.equal(data.usedChangeFromQuantity, 3, "should compare against read-back current quantity");

  // Verify the actual GraphQL variables used changeFromQuantity and NOT the removed fields.
  const call = mutationCall(h)!;
  const body = call.body as { variables: { input: { quantities: Record<string, unknown>[] } } };
  const q = body.variables.input.quantities[0];
  assert.equal(q.changeFromQuantity, 3);
  assert.ok(!("compareQuantity" in q), "must NOT use removed compareQuantity");
  assert.ok(!("ignoreCompareQuantity" in q), "must NOT use removed ignoreCompareQuantity");
});

test("set_inventory_quantity with enforceCompare=false passes changeFromQuantity=null", async () => {
  const h = buildHarness([
    { json: { data: { inventoryItem: { inventoryLevel: { quantities: [{ name: "available", quantity: 3 }] } } } } },
    { json: { data: { inventorySetQuantities: { inventoryAdjustmentGroup: { id: "adj1" }, userErrors: [] } } } },
    { json: { data: { inventoryItem: { inventoryLevel: { quantities: [{ name: "available", quantity: 8 }] } } } } },
  ]);
  await h.call("set_inventory_quantity", {
    inventoryItemId: "ii", locationId: "loc", quantity: 8, enforceCompare: false,
  });
  const call = mutationCall(h)!;
  const q = (call.body as { variables: { input: { quantities: Record<string, unknown>[] } } })
    .variables.input.quantities[0];
  assert.equal(q.changeFromQuantity, null, "skipping CAS must pass explicit null");
});

test("set_inventory_quantity FAILS verification if Shopify reports a different value", async () => {
  const h = buildHarness([
    { json: { data: { inventoryItem: { inventoryLevel: { quantities: [{ name: "available", quantity: 3 }] } } } } },
    { json: { data: { inventorySetQuantities: { inventoryAdjustmentGroup: { id: "adj1" }, userErrors: [] } } } },
    // re-read shows WRONG value
    { json: { data: { inventoryItem: { inventoryLevel: { quantities: [{ name: "available", quantity: 999 }] } } } } },
  ]);
  const res = await h.call("set_inventory_quantity", { inventoryItemId: "ii", locationId: "loc", quantity: 8 });
  assert.equal(res.isError, true);
  assert.match(res.rawText, /Verification failed/i);
});

test("set_inventory_quantity surfaces userErrors instead of claiming success", async () => {
  const h = buildHarness([
    { json: { data: { inventoryItem: { inventoryLevel: { quantities: [{ name: "available", quantity: 3 }] } } } } },
    {
      json: {
        data: {
          inventorySetQuantities: {
            inventoryAdjustmentGroup: null,
            userErrors: [{ field: ["quantities"], message: "stale", code: "CHANGE_FROM_QUANTITY_STALE" }],
          },
        },
      },
    },
  ]);
  const res = await h.call("set_inventory_quantity", { inventoryItemId: "ii", locationId: "loc", quantity: 8 });
  assert.equal(res.isError, true);
  assert.match(res.rawText, /CHANGE_FROM_QUANTITY_STALE|stale/i);
});
