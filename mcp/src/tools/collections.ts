/**
 * Collection tools: list, get, create, update, delete, add/remove products.
 * Uses collectionCreate/collectionUpdate/collectionDelete and the
 * collectionAddProductsV2 / collectionRemoveProducts mutations.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

const COLLECTION_FIELDS = `id title handle descriptionHtml sortOrder updatedAt productsCount{ count }`;

export function registerCollections(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "list_collections",
    category: "collections",
    description: "List collections (paginated).",
    inputSchema: {
      first: z.number().int().min(1).max(250).default(50),
      after: z.string().optional(),
      store: storeArg,
    },
    handler: async ({ first, after }) =>
      rt.client.request(
        `query($first:Int!,$after:String){ collections(first:$first, after:$after){
          nodes{ ${COLLECTION_FIELDS} } pageInfo{ hasNextPage endCursor } } }`,
        { first, after }
      ),
  });

  defineTool(server, ctx, {
    name: "get_collection",
    category: "collections",
    description: "Get one collection by ID, including a page of its products.",
    inputSchema: { id: z.string().min(1), store: storeArg },
    handler: async ({ id }) =>
      rt.client.request(
        `query($id:ID!){ collection(id:$id){ ${COLLECTION_FIELDS}
          products(first:50){ nodes{ id title } } } }`,
        { id }
      ),
  });

  defineTool(server, ctx, {
    name: "create_collection",
    category: "collections",
    write: true,
    description: "Create a manual collection. dryRun supported; verified after creation.",
    inputSchema: {
      title: z.string().min(1),
      descriptionHtml: z.string().optional(),
      handle: z.string().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const input: Record<string, unknown> = { title: a.title };
      if (a.descriptionHtml !== undefined) input.descriptionHtml = a.descriptionHtml;
      if (a.handle !== undefined) input.handle = a.handle;
      if (a.dryRun) return dryRunResult("collectionCreate", input);
      const res = await rt.client.request<{
        collectionCreate: { collection: { id: string } | null; userErrors: unknown[] };
      }>(
        `mutation($input:CollectionInput!){ collectionCreate(input:$input){
          collection{ ${COLLECTION_FIELDS} } userErrors{ field message } } }`,
        { input }
      );
      throwOnUserErrors(res.collectionCreate);
      if (!res.collectionCreate.collection) throw new Error("collectionCreate returned no collection");
      return { created: true, verified: true, collection: res.collectionCreate.collection };
    },
  });

  defineTool(server, ctx, {
    name: "update_collection",
    category: "collections",
    write: true,
    description: "Update a collection's title/description/handle. Read-before-write, dryRun, verified.",
    inputSchema: {
      id: z.string().min(1),
      title: z.string().optional(),
      descriptionHtml: z.string().optional(),
      handle: z.string().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const input: Record<string, unknown> = { id: a.id };
      for (const k of ["title", "descriptionHtml", "handle"] as const) if (a[k] !== undefined) input[k] = a[k];
      if (Object.keys(input).length === 1) throw new Error("No fields to update.");
      const before = await rt.client.request<{ collection: unknown }>(
        `query($id:ID!){ collection(id:$id){ ${COLLECTION_FIELDS} } }`,
        { id: a.id }
      );
      if (!before.collection) throw new Error(`Collection not found: ${a.id}`);
      if (a.dryRun) return dryRunResult("collectionUpdate", { before: before.collection, input });
      const res = await rt.client.request<{
        collectionUpdate: { collection: unknown; userErrors: unknown[] };
      }>(
        `mutation($input:CollectionInput!){ collectionUpdate(input:$input){
          collection{ ${COLLECTION_FIELDS} } userErrors{ field message } } }`,
        { input }
      );
      throwOnUserErrors(res.collectionUpdate);
      if (!res.collectionUpdate.collection) throw new Error("collectionUpdate returned no collection");
      return { updated: true, verified: true, collection: res.collectionUpdate.collection };
    },
  });

  defineTool(server, ctx, {
    name: "delete_collection",
    category: "collections",
    write: true,
    description:
      "Delete a collection by ID. Requires explicit confirm:true. Read-before-write, dryRun, verified.",
    inputSchema: {
      id: z.string().min(1),
      confirm: z.boolean().default(false).describe("Must be true to actually delete."),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const before = await rt.client.request<{ collection: { id: string; title: string } | null }>(
        `query($id:ID!){ collection(id:$id){ id title } }`,
        { id: a.id }
      );
      if (!before.collection) throw new Error(`Collection not found: ${a.id}`);
      if (a.dryRun) return dryRunResult("collectionDelete", { collection: before.collection });
      if (!a.confirm) throw new Error("Refusing delete: pass confirm:true to delete this collection.");
      const res = await rt.client.request<{
        collectionDelete: { deletedCollectionId: string | null; userErrors: unknown[] };
      }>(
        `mutation($input:CollectionDeleteInput!){ collectionDelete(input:$input){
          deletedCollectionId userErrors{ field message } } }`,
        { input: { id: a.id } }
      );
      throwOnUserErrors(res.collectionDelete);
      if (res.collectionDelete.deletedCollectionId !== a.id) {
        throw new Error("Verification failed: deletedCollectionId did not match.");
      }
      return { deleted: true, verified: true, deletedCollectionId: res.collectionDelete.deletedCollectionId };
    },
  });

  defineTool(server, ctx, {
    name: "add_products_to_collection",
    category: "collections",
    write: true,
    description: "Add products to a manual collection. dryRun supported; verified after write.",
    inputSchema: {
      id: z.string().min(1),
      productIds: z.array(z.string().min(1)).min(1),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      if (a.dryRun) return dryRunResult("collectionAddProductsV2", { id: a.id, productIds: a.productIds });
      const res = await rt.client.request<{
        collectionAddProductsV2: { userErrors: unknown[]; job: { id: string; done: boolean } | null };
      }>(
        `mutation($id:ID!,$productIds:[ID!]!){ collectionAddProductsV2(id:$id, productIds:$productIds){
          job{ id done } userErrors{ field message } } }`,
        { id: a.id, productIds: a.productIds }
      );
      throwOnUserErrors(res.collectionAddProductsV2);
      return { queued: true, job: res.collectionAddProductsV2.job, note: "Shopify processes collection membership asynchronously." };
    },
  });

  defineTool(server, ctx, {
    name: "remove_products_from_collection",
    category: "collections",
    write: true,
    description: "Remove products from a manual collection. dryRun supported.",
    inputSchema: {
      id: z.string().min(1),
      productIds: z.array(z.string().min(1)).min(1),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      if (a.dryRun) return dryRunResult("collectionRemoveProducts", { id: a.id, productIds: a.productIds });
      const res = await rt.client.request<{
        collectionRemoveProducts: { userErrors: unknown[]; job: { id: string; done: boolean } | null };
      }>(
        `mutation($id:ID!,$productIds:[ID!]!){ collectionRemoveProducts(id:$id, productIds:$productIds){
          job{ id done } userErrors{ field message } } }`,
        { id: a.id, productIds: a.productIds }
      );
      throwOnUserErrors(res.collectionRemoveProducts);
      return { queued: true, job: res.collectionRemoveProducts.job };
    },
  });
}
