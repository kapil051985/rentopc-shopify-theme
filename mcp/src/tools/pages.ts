/**
 * Online Store page tools: list, get, create, update, delete.
 * Uses pageCreate/pageUpdate/pageDelete (Admin GraphQL, available 2024-10+).
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

const PAGE_FIELDS = `id title handle bodySummary isPublished publishedAt templateSuffix updatedAt`;

export function registerPages(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  const listImpl = (first: number, after?: string) =>
    rt.client.request(
      `query($first:Int!,$after:String){ pages(first:$first, after:$after){
        nodes{ ${PAGE_FIELDS} } pageInfo{ hasNextPage endCursor } } }`,
      { first, after }
    );

  defineTool(server, ctx, {
    name: "list_pages",
    category: "pages",
    description: "List online store pages (summary fields).",
    inputSchema: {
      first: z.number().int().min(1).max(250).default(50),
      after: z.string().optional(),
      store: storeArg,
    },
    handler: async ({ first, after }) => listImpl(first, after),
  });

  defineTool(server, ctx, {
    name: "list_pages_full",
    category: "pages",
    description: "List online store pages including full HTML body.",
    inputSchema: {
      first: z.number().int().min(1).max(100).default(25),
      after: z.string().optional(),
      store: storeArg,
    },
    handler: async ({ first, after }) =>
      rt.client.request(
        `query($first:Int!,$after:String){ pages(first:$first, after:$after){
          nodes{ ${PAGE_FIELDS} body } pageInfo{ hasNextPage endCursor } } }`,
        { first, after }
      ),
  });

  defineTool(server, ctx, {
    name: "get_page",
    category: "pages",
    description: "Get one page by ID, including full HTML body.",
    inputSchema: { id: z.string().min(1), store: storeArg },
    handler: async ({ id }) =>
      rt.client.request(`query($id:ID!){ page(id:$id){ ${PAGE_FIELDS} body } }`, { id }),
  });

  defineTool(server, ctx, {
    name: "create_page",
    category: "pages",
    write: true,
    description: "Create an online store page via pageCreate. dryRun supported; verified.",
    inputSchema: {
      title: z.string().min(1),
      body: z.string().optional(),
      handle: z.string().optional(),
      isPublished: z.boolean().optional(),
      templateSuffix: z.string().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const page: Record<string, unknown> = { title: a.title };
      for (const k of ["body", "handle", "isPublished", "templateSuffix"] as const)
        if (a[k] !== undefined) page[k] = a[k];
      if (a.dryRun) return dryRunResult("pageCreate", page);
      const res = await rt.client.request<{
        pageCreate: { page: { id: string } | null; userErrors: unknown[] };
      }>(
        `mutation($page:PageCreateInput!){ pageCreate(page:$page){
          page{ ${PAGE_FIELDS} } userErrors{ field message code } } }`,
        { page }
      );
      throwOnUserErrors(res.pageCreate);
      if (!res.pageCreate.page) throw new Error("pageCreate returned no page");
      return { created: true, verified: true, page: res.pageCreate.page };
    },
  });

  defineTool(server, ctx, {
    name: "update_page",
    category: "pages",
    write: true,
    description: "Update an online store page via pageUpdate. Read-before-write, dryRun, verified.",
    inputSchema: {
      id: z.string().min(1),
      title: z.string().optional(),
      body: z.string().optional(),
      handle: z.string().optional(),
      isPublished: z.boolean().optional(),
      templateSuffix: z.string().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const page: Record<string, unknown> = {};
      for (const k of ["title", "body", "handle", "isPublished", "templateSuffix"] as const)
        if (a[k] !== undefined) page[k] = a[k];
      if (Object.keys(page).length === 0) throw new Error("No fields to update.");
      const before = await rt.client.request<{ page: unknown }>(
        `query($id:ID!){ page(id:$id){ ${PAGE_FIELDS} } }`,
        { id: a.id }
      );
      if (!before.page) throw new Error(`Page not found: ${a.id}`);
      if (a.dryRun) return dryRunResult("pageUpdate", { id: a.id, before: before.page, page });
      const res = await rt.client.request<{
        pageUpdate: { page: unknown; userErrors: unknown[] };
      }>(
        `mutation($id:ID!,$page:PageUpdateInput!){ pageUpdate(id:$id, page:$page){
          page{ ${PAGE_FIELDS} } userErrors{ field message code } } }`,
        { id: a.id, page }
      );
      throwOnUserErrors(res.pageUpdate);
      if (!res.pageUpdate.page) throw new Error("pageUpdate returned no page");
      return { updated: true, verified: true, page: res.pageUpdate.page };
    },
  });

  defineTool(server, ctx, {
    name: "delete_page",
    category: "pages",
    write: true,
    description: "Delete an online store page via pageDelete. Requires confirm:true. dryRun, verified.",
    inputSchema: {
      id: z.string().min(1),
      confirm: z.boolean().default(false),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const before = await rt.client.request<{ page: { id: string; title: string } | null }>(
        `query($id:ID!){ page(id:$id){ id title } }`,
        { id: a.id }
      );
      if (!before.page) throw new Error(`Page not found: ${a.id}`);
      if (a.dryRun) return dryRunResult("pageDelete", { page: before.page });
      if (!a.confirm) throw new Error("Refusing delete: pass confirm:true to delete this page.");
      const res = await rt.client.request<{
        pageDelete: { deletedPageId: string | null; userErrors: unknown[] };
      }>(
        `mutation($id:ID!){ pageDelete(id:$id){ deletedPageId userErrors{ field message } } }`,
        { id: a.id }
      );
      throwOnUserErrors(res.pageDelete);
      if (res.pageDelete.deletedPageId !== a.id) throw new Error("Verification failed: deletedPageId mismatch.");
      return { deleted: true, verified: true, deletedPageId: res.pageDelete.deletedPageId };
    },
  });
}
