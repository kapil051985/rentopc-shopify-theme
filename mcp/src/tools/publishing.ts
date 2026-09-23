/**
 * Publishing tools: list publications, publish/unpublish a product to channels,
 * and read a product's publication status.
 * Uses publishablePublish / publishableUnpublish.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

export function registerPublishing(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "list_publications",
    category: "publishing",
    description: "List sales-channel publications (e.g. Online Store, POS).",
    inputSchema: {
      first: z.number().int().min(1).max(50).default(25),
      store: storeArg,
    },
    handler: async ({ first }) =>
      rt.client.request(
        `query($first:Int!){ publications(first:$first){ nodes{ id name supportsFuturePublishing } } }`,
        { first }
      ),
  });

  defineTool(server, ctx, {
    name: "get_publication_status",
    category: "publishing",
    description: "Read the publication status of a product across channels.",
    inputSchema: { productId: z.string().min(1), store: storeArg },
    handler: async ({ productId }) =>
      rt.client.request(
        `query($id:ID!){ product(id:$id){ id title
          resourcePublicationsV2(first:25){ nodes{ isPublished publishDate
            publication{ id name } } } } }`,
        { id: productId }
      ),
  });

  defineTool(server, ctx, {
    name: "publish_product",
    category: "publishing",
    write: true,
    description:
      "Publish a product to one or more publications (channels) via publishablePublish. " +
      "dryRun supported; verifies published state after write.",
    inputSchema: {
      productId: z.string().min(1),
      publicationIds: z.array(z.string().min(1)).min(1),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const input = a.publicationIds.map((publicationId) => ({ publicationId }));
      if (a.dryRun) return dryRunResult("publishablePublish", { productId: a.productId, publicationIds: a.publicationIds });
      const res = await rt.client.request<{
        publishablePublish: { publishable: { publishedOnCurrentPublication?: boolean } | null; userErrors: unknown[] };
      }>(
        `mutation($id:ID!,$input:[PublicationInput!]!){ publishablePublish(id:$id, input:$input){
          publishable{ availablePublicationsCount{ count } resourcePublicationsCount{ count } }
          userErrors{ field message } } }`,
        { id: a.productId, input }
      );
      throwOnUserErrors(res.publishablePublish);
      // Verify: confirm each requested publication now reports published.
      const status = await rt.client.request<{
        product: { resourcePublicationsV2: { nodes: { isPublished: boolean; publication: { id: string } }[] } } | null;
      }>(
        `query($id:ID!){ product(id:$id){ resourcePublicationsV2(first:50){ nodes{ isPublished publication{ id } } } } }`,
        { id: a.productId }
      );
      const publishedIds = new Set(
        status.product?.resourcePublicationsV2.nodes.filter((n) => n.isPublished).map((n) => n.publication.id) ?? []
      );
      const notConfirmed = a.publicationIds.filter((id) => !publishedIds.has(id));
      return {
        published: notConfirmed.length === 0,
        verified: true,
        requested: a.publicationIds,
        confirmedPublished: a.publicationIds.filter((id) => publishedIds.has(id)),
        notConfirmed,
      };
    },
  });

  defineTool(server, ctx, {
    name: "unpublish_product",
    category: "publishing",
    write: true,
    description:
      "Unpublish a product from one or more publications via publishableUnpublish. dryRun supported; verified.",
    inputSchema: {
      productId: z.string().min(1),
      publicationIds: z.array(z.string().min(1)).min(1),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const input = a.publicationIds.map((publicationId) => ({ publicationId }));
      if (a.dryRun) return dryRunResult("publishableUnpublish", { productId: a.productId, publicationIds: a.publicationIds });
      const res = await rt.client.request<{
        publishableUnpublish: { publishable: unknown; userErrors: unknown[] };
      }>(
        `mutation($id:ID!,$input:[PublicationInput!]!){ publishableUnpublish(id:$id, input:$input){
          publishable{ resourcePublicationsCount{ count } } userErrors{ field message } } }`,
        { id: a.productId, input }
      );
      throwOnUserErrors(res.publishableUnpublish);
      const status = await rt.client.request<{
        product: { resourcePublicationsV2: { nodes: { isPublished: boolean; publication: { id: string } }[] } } | null;
      }>(
        `query($id:ID!){ product(id:$id){ resourcePublicationsV2(first:50){ nodes{ isPublished publication{ id } } } } }`,
        { id: a.productId }
      );
      const stillPublished = new Set(
        status.product?.resourcePublicationsV2.nodes.filter((n) => n.isPublished).map((n) => n.publication.id) ?? []
      );
      const notConfirmed = a.publicationIds.filter((id) => stillPublished.has(id));
      return {
        unpublished: notConfirmed.length === 0,
        verified: true,
        requested: a.publicationIds,
        stillPublished: notConfirmed,
      };
    },
  });
}
