/**
 * Metafield tools: get, set/update, delete. Uses metafieldsSet and
 * metafieldsDelete (current API).
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

export function registerMetafields(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "get_metafields",
    category: "metafields",
    description: "List metafields on any owner resource (product, collection, etc.) by owner ID.",
    inputSchema: {
      ownerId: z.string().min(1),
      namespace: z.string().optional(),
      first: z.number().int().min(1).max(250).default(50),
      store: storeArg,
    },
    handler: async ({ ownerId, namespace, first }) =>
      rt.client.request(
        `query($id:ID!,$ns:String,$first:Int!){
          node(id:$id){
            ... on HasMetafields {
              metafields(namespace:$ns, first:$first){
                nodes{ id namespace key type value ownerType updatedAt }
              }
            }
          }
        }`,
        { id: ownerId, ns: namespace, first }
      ),
  });

  defineTool(server, ctx, {
    name: "update_metafield",
    category: "metafields",
    write: true,
    description:
      "Set (create or update) a metafield on an owner resource via metafieldsSet. " +
      "dryRun supported; verifies the stored value after write.",
    inputSchema: {
      ownerId: z.string().min(1),
      namespace: z.string().min(1),
      key: z.string().min(1),
      type: z.string().min(1).describe('Metafield type, e.g. "single_line_text_field", "number_integer".'),
      value: z.string().describe("Value as a string (JSON-encoded for structured types)."),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const metafields = [{ ownerId: a.ownerId, namespace: a.namespace, key: a.key, type: a.type, value: a.value }];
      if (a.dryRun) return dryRunResult("metafieldsSet", { metafields });
      const res = await rt.client.request<{
        metafieldsSet: { metafields: { id: string; value: string }[] | null; userErrors: unknown[] };
      }>(
        `mutation($metafields:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$metafields){
          metafields{ id namespace key type value } userErrors{ field message code } } }`,
        { metafields }
      );
      throwOnUserErrors(res.metafieldsSet);
      const set = res.metafieldsSet.metafields?.[0] as { value?: string } | undefined;
      if (set?.value !== a.value) throw new Error("Verification failed: stored value differs from requested value.");
      return { updated: true, verified: true, metafield: res.metafieldsSet.metafields?.[0] };
    },
  });

  defineTool(server, ctx, {
    name: "delete_metafield",
    category: "metafields",
    write: true,
    description: "Delete a metafield by its metafield ID via metafieldsDelete. dryRun supported; verified.",
    inputSchema: {
      metafieldId: z.string().min(1),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      if (a.dryRun) return dryRunResult("metafieldsDelete", { metafieldId: a.metafieldId });
      const res = await rt.client.request<{
        metafieldsDelete: { deletedMetafields: { key: string; namespace: string; ownerId: string }[] | null; userErrors: unknown[] };
      }>(
        `mutation($metafields:[MetafieldIdentifierInput!]!){ metafieldsDelete(metafields:$metafields){
          deletedMetafields{ key namespace ownerId } userErrors{ field message } } }`,
        // metafieldsDelete uses identifiers; but a direct id-based delete is not
        // supported, so we first resolve the identifier from the id.
        { metafields: await resolveIdentifier(rt, a.metafieldId) }
      );
      throwOnUserErrors(res.metafieldsDelete);
      const deleted = res.metafieldsDelete.deletedMetafields ?? [];
      if (deleted.length === 0) throw new Error("Verification failed: nothing was deleted.");
      return { deleted: true, verified: true, deletedMetafields: deleted };
    },
  });
}

async function resolveIdentifier(rt: RuntimeContext, metafieldId: string) {
  const data = await rt.client.request<{
    node: { namespace: string; key: string; owner: { id: string } } | null;
  }>(
    `query($id:ID!){ node(id:$id){ ... on Metafield { namespace key owner{ id } } } }`,
    { id: metafieldId }
  );
  if (!data.node) throw new Error(`Metafield not found: ${metafieldId}`);
  return [{ ownerId: data.node.owner.id, namespace: data.node.namespace, key: data.node.key }];
}
