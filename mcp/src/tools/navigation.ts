/**
 * Navigation (Menu) tools: list, get, create, update, delete.
 * Uses menuCreate/menuUpdate/menuDelete and the menus/menu queries.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

const MENU_FIELDS = `id handle title
  items{ id title type url tags resourceId
    items{ id title type url resourceId } }`;

// Zod schema for a (two-level) menu item.
const menuItemSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    title: z.string(),
    type: z.string().describe('Menu item type, e.g. "FRONTPAGE","HTTP","PRODUCT","COLLECTION","CATALOG".'),
    url: z.string().optional(),
    resourceId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    items: z.array(menuItemSchema).optional(),
  })
);

export function registerNavigation(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "list_navigation",
    category: "navigation",
    description: "List navigation menus.",
    inputSchema: {
      first: z.number().int().min(1).max(250).default(50),
      after: z.string().optional(),
      store: storeArg,
    },
    handler: async ({ first, after }) =>
      rt.client.request(
        `query($first:Int!,$after:String){ menus(first:$first, after:$after){
          nodes{ id handle title isDefault } pageInfo{ hasNextPage endCursor } } }`,
        { first, after }
      ),
  });

  // Alias kept for API parity with the target catalog.
  defineTool(server, ctx, {
    name: "list_menus",
    category: "navigation",
    description: "List navigation menus (alias of list_navigation).",
    inputSchema: {
      first: z.number().int().min(1).max(250).default(50),
      store: storeArg,
    },
    handler: async ({ first }) =>
      rt.client.request(
        `query($first:Int!){ menus(first:$first){ nodes{ id handle title isDefault } } }`,
        { first }
      ),
  });

  defineTool(server, ctx, {
    name: "get_navigation",
    category: "navigation",
    description: "Get one navigation menu by ID, including its items.",
    inputSchema: { id: z.string().min(1), store: storeArg },
    handler: async ({ id }) => rt.client.request(`query($id:ID!){ menu(id:$id){ ${MENU_FIELDS} } }`, { id }),
  });

  defineTool(server, ctx, {
    name: "create_navigation",
    category: "navigation",
    write: true,
    description: "Create a navigation menu via menuCreate. dryRun supported; verified.",
    inputSchema: {
      title: z.string().min(1),
      handle: z.string().min(1),
      items: z.array(menuItemSchema).default([]),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      if (a.dryRun) return dryRunResult("menuCreate", { title: a.title, handle: a.handle, items: a.items });
      const res = await rt.client.request<{
        menuCreate: { menu: { id: string } | null; userErrors: unknown[] };
      }>(
        `mutation($title:String!,$handle:String!,$items:[MenuItemCreateInput!]!){
          menuCreate(title:$title, handle:$handle, items:$items){
            menu{ ${MENU_FIELDS} } userErrors{ field message } } }`,
        { title: a.title, handle: a.handle, items: a.items }
      );
      throwOnUserErrors(res.menuCreate);
      if (!res.menuCreate.menu) throw new Error("menuCreate returned no menu");
      return { created: true, verified: true, menu: res.menuCreate.menu };
    },
  });

  defineTool(server, ctx, {
    name: "update_navigation",
    category: "navigation",
    write: true,
    description: "Update a navigation menu via menuUpdate. Read-before-write, dryRun, verified.",
    inputSchema: {
      id: z.string().min(1),
      title: z.string().min(1),
      handle: z.string().min(1),
      items: z.array(menuItemSchema).default([]),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const before = await rt.client.request<{ menu: unknown }>(
        `query($id:ID!){ menu(id:$id){ id handle title } }`,
        { id: a.id }
      );
      if (!before.menu) throw new Error(`Menu not found: ${a.id}`);
      if (a.dryRun) return dryRunResult("menuUpdate", { id: a.id, before: before.menu, title: a.title, handle: a.handle, items: a.items });
      const res = await rt.client.request<{
        menuUpdate: { menu: unknown; userErrors: unknown[] };
      }>(
        `mutation($id:ID!,$title:String!,$handle:String!,$items:[MenuItemUpdateInput!]!){
          menuUpdate(id:$id, title:$title, handle:$handle, items:$items){
            menu{ ${MENU_FIELDS} } userErrors{ field message } } }`,
        { id: a.id, title: a.title, handle: a.handle, items: a.items }
      );
      throwOnUserErrors(res.menuUpdate);
      if (!res.menuUpdate.menu) throw new Error("menuUpdate returned no menu");
      return { updated: true, verified: true, menu: res.menuUpdate.menu };
    },
  });

  defineTool(server, ctx, {
    name: "delete_navigation",
    category: "navigation",
    write: true,
    description: "Delete a navigation menu via menuDelete. Requires confirm:true. dryRun, verified.",
    inputSchema: {
      id: z.string().min(1),
      confirm: z.boolean().default(false),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const before = await rt.client.request<{ menu: { id: string; title: string } | null }>(
        `query($id:ID!){ menu(id:$id){ id title } }`,
        { id: a.id }
      );
      if (!before.menu) throw new Error(`Menu not found: ${a.id}`);
      if (a.dryRun) return dryRunResult("menuDelete", { menu: before.menu });
      if (!a.confirm) throw new Error("Refusing delete: pass confirm:true to delete this menu.");
      const res = await rt.client.request<{
        menuDelete: { deletedMenuId: string | null; userErrors: unknown[] };
      }>(
        `mutation($id:ID!){ menuDelete(id:$id){ deletedMenuId userErrors{ field message } } }`,
        { id: a.id }
      );
      throwOnUserErrors(res.menuDelete);
      if (res.menuDelete.deletedMenuId !== a.id) throw new Error("Verification failed: id mismatch.");
      return { deleted: true, verified: true, deletedMenuId: res.menuDelete.deletedMenuId };
    },
  });
}
