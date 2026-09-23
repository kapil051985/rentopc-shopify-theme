/**
 * Registers every tool module onto the MCP server and returns the registry
 * of tool metadata (used by diagnostics and the self-test).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RuntimeContext } from "../context.js";
import type { ToolContext } from "../safety.js";

import { registerDiagnostics } from "./diagnostics.js";
import { registerProducts } from "./products.js";
import { registerVariants } from "./variants.js";
import { registerInventory } from "./inventory.js";
import { registerMedia } from "./media.js";
import { registerCollections } from "./collections.js";
import { registerMetafields } from "./metafields.js";
import { registerFiles } from "./files.js";
import { registerPages } from "./pages.js";
import { registerRedirects } from "./redirects.js";
import { registerNavigation } from "./navigation.js";
import { registerMetaobjects } from "./metaobjects.js";
import { registerPublishing } from "./publishing.js";
import { registerThemes } from "./themes.js";

export function registerAllTools(
  server: McpServer,
  rt: RuntimeContext
): ToolContext {
  const ctx: ToolContext = { registered: [] };
  registerDiagnostics(server, ctx, rt);
  registerProducts(server, ctx, rt);
  registerVariants(server, ctx, rt);
  registerInventory(server, ctx, rt);
  registerMedia(server, ctx, rt);
  registerCollections(server, ctx, rt);
  registerMetafields(server, ctx, rt);
  registerFiles(server, ctx, rt);
  registerPages(server, ctx, rt);
  registerRedirects(server, ctx, rt);
  registerNavigation(server, ctx, rt);
  registerMetaobjects(server, ctx, rt);
  registerPublishing(server, ctx, rt);
  registerThemes(server, ctx, rt);
  return ctx;
}
