/**
 * Inventory tools for Admin API 2026-07.
 *
 * Uses inventorySetQuantities with InventoryQuantityInput.changeFromQuantity
 * (the current API). changeFromQuantity is MANDATORY: pass an integer to
 * enforce a compare-and-swap safety check, or null to skip it. The removed
 * compareQuantity / ignoreCompareQuantity fields are NOT used.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

export function registerInventory(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "list_inventory_items",
    category: "inventory",
    description: "List inventory items with their levels per location.",
    inputSchema: {
      first: z.number().int().min(1).max(250).default(50),
      after: z.string().optional(),
      store: storeArg,
    },
    handler: async ({ first, after }) =>
      rt.client.request(
        `query($first:Int!,$after:String){
          inventoryItems(first:$first, after:$after){
            nodes{
              id sku tracked
              variant{ id title product{ id title } }
              inventoryLevels(first:10){
                nodes{ location{ id name } quantities(names:["available"]){ name quantity } }
              }
            }
            pageInfo{ hasNextPage endCursor }
          }
        }`,
        { first, after }
      ),
  });

  defineTool(server, ctx, {
    name: "get_inventory_level",
    category: "inventory",
    description:
      "Read the current available quantity for an inventory item at a location. " +
      "Useful to obtain the value to pass as changeFromQuantity.",
    inputSchema: {
      inventoryItemId: z.string().min(1),
      locationId: z.string().min(1),
      store: storeArg,
    },
    handler: async ({ inventoryItemId, locationId }) => {
      const data = await rt.client.request<{
        inventoryItem: {
          id: string;
          inventoryLevel: { quantities: { name: string; quantity: number }[] } | null;
        } | null;
      }>(
        `query($id:ID!,$loc:ID!){
          inventoryItem(id:$id){
            id sku
            inventoryLevel(locationId:$loc){ quantities(names:["available"]){ name quantity } }
          }
        }`,
        { id: inventoryItemId, loc: locationId }
      );
      const available =
        data.inventoryItem?.inventoryLevel?.quantities?.find((q) => q.name === "available")
          ?.quantity ?? null;
      return { inventoryItemId, locationId, available };
    },
  });

  defineTool(server, ctx, {
    name: "set_inventory_quantity",
    category: "inventory",
    write: true,
    description:
      "Set absolute available inventory for an item at a location using the " +
      "2026-07 inventorySetQuantities API. changeFromQuantity performs a " +
      "compare-and-swap: pass the expected current quantity to guard against " +
      "concurrent updates, or set enforceCompare:false to skip the check. " +
      "Reads current level, supports dryRun, verifies the result.",
    inputSchema: {
      inventoryItemId: z.string().min(1),
      locationId: z.string().min(1),
      quantity: z.number().int().describe("The absolute quantity to set."),
      enforceCompare: z
        .boolean()
        .default(true)
        .describe(
          "If true, use the read-back current quantity (or expectedCurrent) as " +
            "changeFromQuantity for a compare-and-swap. If false, pass null to skip."
        ),
      expectedCurrent: z
        .number()
        .int()
        .optional()
        .describe("Override the compare value instead of using the live read-back."),
      reason: z.string().default("correction"),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      // Read current available for verification and compare-and-swap.
      const cur = await rt.client.request<{
        inventoryItem: {
          inventoryLevel: { quantities: { name: string; quantity: number }[] } | null;
        } | null;
      }>(
        `query($id:ID!,$loc:ID!){ inventoryItem(id:$id){
          inventoryLevel(locationId:$loc){ quantities(names:["available"]){ name quantity } } } }`,
        { id: a.inventoryItemId, loc: a.locationId }
      );
      const currentAvailable =
        cur.inventoryItem?.inventoryLevel?.quantities?.find((q) => q.name === "available")
          ?.quantity ?? 0;

      // changeFromQuantity is mandatory: integer to compare, or null to skip.
      const changeFromQuantity: number | null = a.enforceCompare
        ? a.expectedCurrent ?? currentAvailable
        : null;

      const quantities = [
        {
          inventoryItemId: a.inventoryItemId,
          locationId: a.locationId,
          quantity: a.quantity,
          changeFromQuantity,
        },
      ];

      if (a.dryRun) {
        return dryRunResult("inventorySetQuantities", {
          currentAvailable,
          targetQuantity: a.quantity,
          changeFromQuantity,
          reason: a.reason,
        });
      }

      const res = await rt.client.request<{
        inventorySetQuantities: {
          inventoryAdjustmentGroup: { id: string } | null;
          userErrors: { field: string[]; message: string; code?: string }[];
        };
      }>(
        `mutation($input:InventorySetQuantitiesInput!){
          inventorySetQuantities(input:$input){
            inventoryAdjustmentGroup{ id reason }
            userErrors{ field message code }
          }
        }`,
        {
          input: {
            name: "available",
            reason: a.reason,
            quantities,
          },
        }
      );
      throwOnUserErrors(res.inventorySetQuantities);

      // Verify by re-reading.
      const after = await rt.client.request<{
        inventoryItem: {
          inventoryLevel: { quantities: { name: string; quantity: number }[] } | null;
        } | null;
      }>(
        `query($id:ID!,$loc:ID!){ inventoryItem(id:$id){
          inventoryLevel(locationId:$loc){ quantities(names:["available"]){ name quantity } } } }`,
        { id: a.inventoryItemId, loc: a.locationId }
      );
      const newAvailable =
        after.inventoryItem?.inventoryLevel?.quantities?.find((q) => q.name === "available")
          ?.quantity ?? null;
      if (newAvailable !== a.quantity) {
        throw new Error(
          `Verification failed: Shopify reports available=${newAvailable}, expected ${a.quantity}`
        );
      }
      return {
        updated: true,
        verified: true,
        previousAvailable: currentAvailable,
        newAvailable,
        usedChangeFromQuantity: changeFromQuantity,
      };
    },
  });
}
