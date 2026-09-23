/**
 * Metaobject tools: list, get, create, update, delete.
 * Uses metaobjectCreate/metaobjectUpdate/metaobjectDelete.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

const MO_FIELDS = `id handle type displayName updatedAt fields{ key value type }`;

const fieldInput = z.object({ key: z.string(), value: z.string() });

export function registerMetaobjects(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "list_metaobjects",
    category: "metaobjects",
    description: "List metaobjects of a given type.",
    inputSchema: {
      type: z.string().min(1),
      first: z.number().int().min(1).max(250).default(50),
      after: z.string().optional(),
      store: storeArg,
    },
    handler: async ({ type, first, after }) =>
      rt.client.request(
        `query($type:String!,$first:Int!,$after:String){
          metaobjects(type:$type, first:$first, after:$after){
            nodes{ ${MO_FIELDS} } pageInfo{ hasNextPage endCursor } } }`,
        { type, first, after }
      ),
  });

  defineTool(server, ctx, {
    name: "get_metaobject",
    category: "metaobjects",
    description: "Get one metaobject by ID.",
    inputSchema: { id: z.string().min(1), store: storeArg },
    handler: async ({ id }) => rt.client.request(`query($id:ID!){ metaobject(id:$id){ ${MO_FIELDS} } }`, { id }),
  });

  defineTool(server, ctx, {
    name: "create_metaobject",
    category: "metaobjects",
    write: true,
    description: "Create a metaobject of a given type via metaobjectCreate. dryRun supported; verified.",
    inputSchema: {
      type: z.string().min(1),
      handle: z.string().optional(),
      fields: z.array(fieldInput).default([]),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const metaobject: Record<string, unknown> = { type: a.type, fields: a.fields };
      if (a.handle !== undefined) metaobject.handle = a.handle;
      if (a.dryRun) return dryRunResult("metaobjectCreate", metaobject);
      const res = await rt.client.request<{
        metaobjectCreate: { metaobject: { id: string } | null; userErrors: unknown[] };
      }>(
        `mutation($metaobject:MetaobjectCreateInput!){ metaobjectCreate(metaobject:$metaobject){
          metaobject{ ${MO_FIELDS} } userErrors{ field message code } } }`,
        { metaobject }
      );
      throwOnUserErrors(res.metaobjectCreate);
      if (!res.metaobjectCreate.metaobject) throw new Error("metaobjectCreate returned nothing");
      return { created: true, verified: true, metaobject: res.metaobjectCreate.metaobject };
    },
  });

  defineTool(server, ctx, {
    name: "update_metaobject",
    category: "metaobjects",
    write: true,
    description: "Update a metaobject's fields/handle via metaobjectUpdate. Read-before-write, dryRun, verified.",
    inputSchema: {
      id: z.string().min(1),
      handle: z.string().optional(),
      fields: z.array(fieldInput).default([]),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const before = await rt.client.request<{ metaobject: unknown }>(
        `query($id:ID!){ metaobject(id:$id){ ${MO_FIELDS} } }`,
        { id: a.id }
      );
      if (!before.metaobject) throw new Error(`Metaobject not found: ${a.id}`);
      const metaobject: Record<string, unknown> = { fields: a.fields };
      if (a.handle !== undefined) metaobject.handle = a.handle;
      if (a.dryRun) return dryRunResult("metaobjectUpdate", { id: a.id, before: before.metaobject, metaobject });
      const res = await rt.client.request<{
        metaobjectUpdate: { metaobject: unknown; userErrors: unknown[] };
      }>(
        `mutation($id:ID!,$metaobject:MetaobjectUpdateInput!){ metaobjectUpdate(id:$id, metaobject:$metaobject){
          metaobject{ ${MO_FIELDS} } userErrors{ field message code } } }`,
        { id: a.id, metaobject }
      );
      throwOnUserErrors(res.metaobjectUpdate);
      if (!res.metaobjectUpdate.metaobject) throw new Error("metaobjectUpdate returned nothing");
      return { updated: true, verified: true, metaobject: res.metaobjectUpdate.metaobject };
    },
  });

  defineTool(server, ctx, {
    name: "delete_metaobject",
    category: "metaobjects",
    write: true,
    description: "Delete a metaobject by ID via metaobjectDelete. Requires confirm:true. dryRun, verified.",
    inputSchema: {
      id: z.string().min(1),
      confirm: z.boolean().default(false),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const before = await rt.client.request<{ metaobject: { id: string } | null }>(
        `query($id:ID!){ metaobject(id:$id){ id handle type } }`,
        { id: a.id }
      );
      if (!before.metaobject) throw new Error(`Metaobject not found: ${a.id}`);
      if (a.dryRun) return dryRunResult("metaobjectDelete", { metaobject: before.metaobject });
      if (!a.confirm) throw new Error("Refusing delete: pass confirm:true to delete this metaobject.");
      const res = await rt.client.request<{
        metaobjectDelete: { deletedId: string | null; userErrors: unknown[] };
      }>(
        `mutation($id:ID!){ metaobjectDelete(id:$id){ deletedId userErrors{ field message } } }`,
        { id: a.id }
      );
      throwOnUserErrors(res.metaobjectDelete);
      if (res.metaobjectDelete.deletedId !== a.id) throw new Error("Verification failed: id mismatch.");
      return { deleted: true, verified: true, deletedId: res.metaobjectDelete.deletedId };
    },
  });
}
