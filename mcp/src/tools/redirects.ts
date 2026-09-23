/**
 * URL redirect tools: list, search, create, update, delete.
 * Uses urlRedirectCreate/urlRedirectUpdate/urlRedirectDelete.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

const REDIRECT_FIELDS = `id path target`;

export function registerRedirects(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "list_redirects",
    category: "redirects",
    description: "List URL redirects (paginated).",
    inputSchema: {
      first: z.number().int().min(1).max(250).default(50),
      after: z.string().optional(),
      store: storeArg,
    },
    handler: async ({ first, after }) =>
      rt.client.request(
        `query($first:Int!,$after:String){ urlRedirects(first:$first, after:$after){
          nodes{ ${REDIRECT_FIELDS} } pageInfo{ hasNextPage endCursor } } }`,
        { first, after }
      ),
  });

  defineTool(server, ctx, {
    name: "search_redirects",
    category: "redirects",
    description: "Search URL redirects by query string (e.g. path or target).",
    inputSchema: {
      query: z.string().min(1),
      first: z.number().int().min(1).max(250).default(50),
      store: storeArg,
    },
    handler: async ({ query, first }) =>
      rt.client.request(
        `query($q:String!,$first:Int!){ urlRedirects(first:$first, query:$q){
          nodes{ ${REDIRECT_FIELDS} } } }`,
        { q: query, first }
      ),
  });

  defineTool(server, ctx, {
    name: "create_redirect",
    category: "redirects",
    write: true,
    description: "Create a URL redirect. dryRun supported; verified after creation.",
    inputSchema: {
      path: z.string().min(1).describe('Old path, e.g. "/old-url".'),
      target: z.string().min(1).describe('New target, e.g. "/new-url" or a full URL.'),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const input = { path: a.path, target: a.target };
      if (a.dryRun) return dryRunResult("urlRedirectCreate", input);
      const res = await rt.client.request<{
        urlRedirectCreate: { urlRedirect: { id: string } | null; userErrors: unknown[] };
      }>(
        `mutation($input:UrlRedirectInput!){ urlRedirectCreate(urlRedirect:$input){
          urlRedirect{ ${REDIRECT_FIELDS} } userErrors{ field message } } }`,
        { input }
      );
      throwOnUserErrors(res.urlRedirectCreate);
      if (!res.urlRedirectCreate.urlRedirect) throw new Error("urlRedirectCreate returned nothing");
      return { created: true, verified: true, redirect: res.urlRedirectCreate.urlRedirect };
    },
  });

  defineTool(server, ctx, {
    name: "update_redirect",
    category: "redirects",
    write: true,
    description: "Update a URL redirect's path/target. Read-before-write, dryRun, verified.",
    inputSchema: {
      id: z.string().min(1),
      path: z.string().optional(),
      target: z.string().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      if (a.path === undefined && a.target === undefined) throw new Error("Provide path and/or target.");
      const before = await rt.client.request<{ urlRedirect: { id: string; path: string; target: string } | null }>(
        `query($id:ID!){ urlRedirect(id:$id){ ${REDIRECT_FIELDS} } }`,
        { id: a.id }
      );
      if (!before.urlRedirect) throw new Error(`Redirect not found: ${a.id}`);
      const input = { path: a.path ?? before.urlRedirect.path, target: a.target ?? before.urlRedirect.target };
      if (a.dryRun) return dryRunResult("urlRedirectUpdate", { id: a.id, before: before.urlRedirect, input });
      const res = await rt.client.request<{
        urlRedirectUpdate: { urlRedirect: unknown; userErrors: unknown[] };
      }>(
        `mutation($id:ID!,$input:UrlRedirectInput!){ urlRedirectUpdate(id:$id, urlRedirect:$input){
          urlRedirect{ ${REDIRECT_FIELDS} } userErrors{ field message } } }`,
        { id: a.id, input }
      );
      throwOnUserErrors(res.urlRedirectUpdate);
      if (!res.urlRedirectUpdate.urlRedirect) throw new Error("urlRedirectUpdate returned nothing");
      return { updated: true, verified: true, redirect: res.urlRedirectUpdate.urlRedirect };
    },
  });

  defineTool(server, ctx, {
    name: "delete_redirect",
    category: "redirects",
    write: true,
    description: "Delete a URL redirect by ID. dryRun supported; verified.",
    inputSchema: {
      id: z.string().min(1),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const before = await rt.client.request<{ urlRedirect: { id: string } | null }>(
        `query($id:ID!){ urlRedirect(id:$id){ id path target } }`,
        { id: a.id }
      );
      if (!before.urlRedirect) throw new Error(`Redirect not found: ${a.id}`);
      if (a.dryRun) return dryRunResult("urlRedirectDelete", { redirect: before.urlRedirect });
      const res = await rt.client.request<{
        urlRedirectDelete: { deletedUrlRedirectId: string | null; userErrors: unknown[] };
      }>(
        `mutation($id:ID!){ urlRedirectDelete(id:$id){ deletedUrlRedirectId userErrors{ field message } } }`,
        { id: a.id }
      );
      throwOnUserErrors(res.urlRedirectDelete);
      if (res.urlRedirectDelete.deletedUrlRedirectId !== a.id) throw new Error("Verification failed: id mismatch.");
      return { deleted: true, verified: true, deletedUrlRedirectId: res.urlRedirectDelete.deletedUrlRedirectId };
    },
  });
}
