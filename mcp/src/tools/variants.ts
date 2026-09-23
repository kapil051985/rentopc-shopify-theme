/**
 * Variant tools: list, get, update (general), update_variant_price.
 * Uses productVariantsBulkUpdate (current API; single productVariantUpdate is
 * deprecated in recent versions).
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

const VARIANT_FIELDS = `id title sku price compareAtPrice barcode inventoryQuantity
  selectedOptions{ name value } product{ id title }`;

export function registerVariants(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "list_variants",
    category: "variants",
    description: "List variants for a product.",
    inputSchema: {
      productId: z.string().min(1),
      first: z.number().int().min(1).max(250).default(100),
      store: storeArg,
    },
    handler: async ({ productId, first }) =>
      rt.client.request(
        `query($id:ID!,$first:Int!){ product(id:$id){ id title
          variants(first:$first){ nodes{ ${VARIANT_FIELDS} } } } }`,
        { id: productId, first }
      ),
  });

  defineTool(server, ctx, {
    name: "get_variant",
    category: "variants",
    description: "Get a single variant by ID.",
    inputSchema: { id: z.string().min(1), store: storeArg },
    handler: async ({ id }) =>
      rt.client.request(
        `query($id:ID!){ productVariant(id:$id){ ${VARIANT_FIELDS}
          inventoryItem{ id sku } } }`,
        { id }
      ),
  });

  async function bulkUpdate(
    rtc: RuntimeContext,
    productId: string,
    variant: Record<string, unknown>
  ) {
    const res = await rtc.client.request<{
      productVariantsBulkUpdate: {
        productVariants: { id: string }[] | null;
        userErrors: unknown[];
      };
    }>(
      `mutation($productId:ID!,$variants:[ProductVariantsBulkInput!]!){
        productVariantsBulkUpdate(productId:$productId, variants:$variants){
          productVariants{ ${VARIANT_FIELDS} }
          userErrors{ field message }
        }
      }`,
      { productId, variants: [variant] }
    );
    throwOnUserErrors(res.productVariantsBulkUpdate);
    const updated = res.productVariantsBulkUpdate.productVariants?.[0];
    if (!updated) throw new Error("productVariantsBulkUpdate returned no variant");
    return updated;
  }

  async function resolveProductId(rtc: RuntimeContext, variantId: string): Promise<string> {
    const q = await rtc.client.request<{ productVariant: { product: { id: string } } | null }>(
      `query($id:ID!){ productVariant(id:$id){ id product{ id } } }`,
      { id: variantId }
    );
    if (!q.productVariant) throw new Error(`Variant not found: ${variantId}`);
    return q.productVariant.product.id;
  }

  defineTool(server, ctx, {
    name: "update_variant",
    category: "variants",
    write: true,
    description:
      "Update variant fields (price, compareAtPrice, barcode, taxable). " +
      "Reads current state, supports dryRun, verifies after write.",
    inputSchema: {
      id: z.string().min(1),
      productId: z.string().optional().describe("Parent product ID; resolved automatically if omitted."),
      price: z.string().optional(),
      compareAtPrice: z.string().optional(),
      barcode: z.string().optional(),
      taxable: z.boolean().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const variant: Record<string, unknown> = { id: a.id };
      for (const k of ["price", "compareAtPrice", "barcode", "taxable"] as const) {
        if (a[k] !== undefined) variant[k] = a[k];
      }
      if (Object.keys(variant).length === 1) throw new Error("No variant fields to update.");
      const productId = a.productId ?? (await resolveProductId(rt, a.id));
      const before = await rt.client.request(
        `query($id:ID!){ productVariant(id:$id){ ${VARIANT_FIELDS} } }`,
        { id: a.id }
      );
      if (a.dryRun) return dryRunResult("productVariantsBulkUpdate", { before, productId, variant });
      const updated = await bulkUpdate(rt, productId, variant);
      return { updated: true, verified: true, variant: updated };
    },
  });

  defineTool(server, ctx, {
    name: "update_variant_price",
    category: "variants",
    write: true,
    description:
      "Update a variant's price (and optionally compareAtPrice). Reads current " +
      "price, supports dryRun, verifies the new price after write.",
    inputSchema: {
      id: z.string().min(1),
      price: z.string().min(1).describe("New price as a decimal string, e.g. \"19.99\"."),
      compareAtPrice: z.string().optional(),
      productId: z.string().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const productId = a.productId ?? (await resolveProductId(rt, a.id));
      const before = await rt.client.request<{ productVariant: { price: string } | null }>(
        `query($id:ID!){ productVariant(id:$id){ id price compareAtPrice } }`,
        { id: a.id }
      );
      if (!before.productVariant) throw new Error(`Variant not found: ${a.id}`);
      const variant: Record<string, unknown> = { id: a.id, price: a.price };
      if (a.compareAtPrice !== undefined) variant.compareAtPrice = a.compareAtPrice;
      if (a.dryRun)
        return dryRunResult("productVariantsBulkUpdate(price)", {
          from: before.productVariant.price,
          to: a.price,
          productId,
        });
      const updated = await bulkUpdate(rt, productId, variant);
      // Verify the price actually changed to the requested value.
      const confirmedPrice = (updated as { price?: string }).price;
      if (confirmedPrice !== a.price) {
        throw new Error(
          `Verification failed: Shopify reports price ${confirmedPrice}, expected ${a.price}`
        );
      }
      return { updated: true, verified: true, price: confirmedPrice, variant: updated };
    },
  });
}
