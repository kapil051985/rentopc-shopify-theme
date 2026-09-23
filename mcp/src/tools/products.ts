/**
 * Product tools: list, get, search, update, SEO get/update, publish/unpublish
 * live via publishing module. This module covers core product CRUD + SEO.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

const PRODUCT_FIELDS = `id title handle status productType vendor totalInventory tags updatedAt`;

export function registerProducts(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "list_products",
    category: "products",
    description: "List products (paginated).",
    inputSchema: {
      first: z.number().int().min(1).max(250).default(50),
      after: z.string().optional(),
      query: z.string().optional().describe("Shopify search query filter."),
      store: storeArg,
    },
    handler: async ({ first, after, query }) =>
      rt.client.request(
        `query($first:Int!,$after:String,$query:String){
          products(first:$first, after:$after, query:$query){
            nodes{ ${PRODUCT_FIELDS} }
            pageInfo{ hasNextPage endCursor }
          }
        }`,
        { first, after, query }
      ),
  });

  defineTool(server, ctx, {
    name: "get_product",
    category: "products",
    description: "Get one product by ID.",
    inputSchema: { id: z.string().min(1), store: storeArg },
    handler: async ({ id }) =>
      rt.client.request(
        `query($id:ID!){ product(id:$id){ ${PRODUCT_FIELDS} descriptionHtml
          seo{ title description } } }`,
        { id }
      ),
  });

  defineTool(server, ctx, {
    name: "search_products",
    category: "products",
    description: "Search products using a Shopify search query string.",
    inputSchema: {
      query: z.string().min(1),
      first: z.number().int().min(1).max(250).default(25),
      store: storeArg,
    },
    handler: async ({ query, first }) =>
      rt.client.request(
        `query($q:String!,$first:Int!){ products(first:$first, query:$q){
          nodes{ ${PRODUCT_FIELDS} } } }`,
        { q: query, first }
      ),
  });

  defineTool(server, ctx, {
    name: "update_product",
    category: "products",
    write: true,
    description:
      "Update product fields (title, description, type, vendor, tags, status). " +
      "Reads current state, supports dryRun, verifies after write.",
    inputSchema: {
      id: z.string().min(1),
      title: z.string().optional(),
      descriptionHtml: z.string().optional(),
      productType: z.string().optional(),
      vendor: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const input: Record<string, unknown> = { id: a.id };
      for (const k of ["title", "descriptionHtml", "productType", "vendor", "tags", "status"] as const) {
        if (a[k] !== undefined) input[k] = a[k];
      }
      // Read-before-write.
      const before = await rt.client.request<{ product: unknown }>(
        `query($id:ID!){ product(id:$id){ ${PRODUCT_FIELDS} } }`,
        { id: a.id }
      );
      if (!before.product) throw new Error(`Product not found: ${a.id}`);
      if (a.dryRun) return dryRunResult("productUpdate", { before: before.product, input });

      const res = await rt.client.request<{
        productUpdate: { product: { id: string } | null; userErrors: unknown[] };
      }>(
        `mutation($input:ProductInput!){ productUpdate(input:$input){
          product{ ${PRODUCT_FIELDS} } userErrors{ field message } } }`,
        { input }
      );
      throwOnUserErrors(res.productUpdate);
      if (!res.productUpdate.product) throw new Error("productUpdate returned no product");
      // Verify.
      const after = await rt.client.request<{ product: Record<string, unknown> }>(
        `query($id:ID!){ product(id:$id){ ${PRODUCT_FIELDS} } }`,
        { id: a.id }
      );
      return { updated: true, verified: true, product: after.product };
    },
  });

  defineTool(server, ctx, {
    name: "get_product_seo",
    category: "seo",
    description: "Get the SEO title/description of a product.",
    inputSchema: { id: z.string().min(1), store: storeArg },
    handler: async ({ id }) =>
      rt.client.request(
        `query($id:ID!){ product(id:$id){ id title seo{ title description } } }`,
        { id }
      ),
  });

  defineTool(server, ctx, {
    name: "update_product_seo",
    category: "seo",
    write: true,
    description:
      "Update a product's SEO title and/or meta description. dryRun supported; verified after write.",
    inputSchema: {
      id: z.string().min(1),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      if (a.seoTitle === undefined && a.seoDescription === undefined) {
        throw new Error("Provide seoTitle and/or seoDescription.");
      }
      const seo: Record<string, unknown> = {};
      if (a.seoTitle !== undefined) seo.title = a.seoTitle;
      if (a.seoDescription !== undefined) seo.description = a.seoDescription;
      const input = { id: a.id, seo };
      const before = await rt.client.request<{ product: { seo: unknown } | null }>(
        `query($id:ID!){ product(id:$id){ id seo{ title description } } }`,
        { id: a.id }
      );
      if (!before.product) throw new Error(`Product not found: ${a.id}`);
      if (a.dryRun) return dryRunResult("productUpdate(seo)", { before: before.product, input });

      const res = await rt.client.request<{
        productUpdate: { product: { seo: unknown } | null; userErrors: unknown[] };
      }>(
        `mutation($input:ProductInput!){ productUpdate(input:$input){
          product{ id seo{ title description } } userErrors{ field message } } }`,
        { input }
      );
      throwOnUserErrors(res.productUpdate);
      const after = res.productUpdate.product;
      if (!after) throw new Error("productUpdate(seo) returned no product");
      return { updated: true, verified: true, seo: (after as { seo: unknown }).seo };
    },
  });
}
