/**
 * Diagnostics & auth tools: get_auth_status, verify_shopify_scopes, get_shop,
 * shopify_graphql_query.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { getAuditLog } from "../audit.js";

export function registerDiagnostics(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "get_auth_status",
    category: "diagnostics",
    description:
      "Report authentication mode, whether credentials are configured, store, " +
      "API version and token expiry. Never returns the secret or access token.",
    inputSchema: {},
    handler: async () => {
      const s = rt.provider.status();
      return {
        store: rt.store,
        apiVersion: rt.apiVersion,
        authMode: s.mode,
        credentialsConfigured: s.credentialsConfigured,
        canRefresh: s.canRefresh,
        tokenPresent: s.hasToken,
        tokenExpiresAt: s.expiresAt,
        tokenExpiresInSeconds: s.expiresInSeconds,
      };
    },
  });

  defineTool(server, ctx, {
    name: "verify_shopify_scopes",
    category: "diagnostics",
    description:
      "Read back the access scopes granted to this app plus store/API version. " +
      "Performs a live read-only Shopify query. Never returns credentials.",
    inputSchema: {},
    handler: async () => {
      const data = await rt.client.request<{
        currentAppInstallation?: { accessScopes?: { handle: string }[] };
      }>(
        `query { currentAppInstallation { accessScopes { handle } } }`
      );
      const scopes =
        data.currentAppInstallation?.accessScopes?.map((s) => s.handle) ?? [];
      return {
        store: rt.store,
        apiVersion: rt.apiVersion,
        authMode: rt.provider.mode,
        grantedScopes: scopes,
        scopeCount: scopes.length,
      };
    },
  });

  defineTool(server, ctx, {
    name: "get_shop",
    category: "diagnostics",
    description: "Read basic shop information (name, domains, plan, currency).",
    inputSchema: {},
    handler: async () =>
      rt.client.request(
        `query { shop { name myshopifyDomain primaryDomain { host url } email currencyCode plan { displayName } } }`
      ),
  });

  defineTool(server, ctx, {
    name: "shopify_graphql_query",
    category: "diagnostics",
    description:
      "Run an arbitrary READ-ONLY GraphQL query against the Admin API. " +
      "Mutations are rejected; use the dedicated write tools instead.",
    inputSchema: {
      query: z.string().min(1).describe("A GraphQL query (must start with 'query')."),
      variables: z.record(z.any()).optional(),
    },
    handler: async ({ query, variables }) => {
      if (!/^\s*(query\b|\{)/i.test(query) || /\bmutation\b/i.test(query)) {
        throw new Error(
          "Only read-only query operations are allowed via this tool."
        );
      }
      return rt.client.request(query, variables ?? {});
    },
  });

  defineTool(server, ctx, {
    name: "get_audit_log",
    category: "diagnostics",
    description:
      "Return the recent local audit trail of tool invocations (redacted). " +
      "Never contains credentials.",
    inputSchema: {
      limit: z.number().int().positive().max(500).default(50),
    },
    handler: async ({ limit }) => {
      const log = getAuditLog();
      return { entries: log.slice(-limit), total: log.length };
    },
  });
}
