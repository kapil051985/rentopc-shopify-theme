/**
 * Server factory: builds the MCP server, wires the runtime context, and
 * registers all tools. Kept separate from the stdio entrypoint so tests and
 * the self-test can instantiate the server without a transport or network.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assertStoreEnv } from "./config.js";
import { createRuntimeContext, type RuntimeContext } from "./context.js";
import { registerAllTools } from "./tools/index.js";
import type { ToolContext } from "./safety.js";
import type { FetchLike, TokenProvider } from "./auth.js";

export interface CreatedServer {
  server: McpServer;
  toolContext: ToolContext;
  runtime: RuntimeContext;
}

export function createServer(opts?: {
  provider?: TokenProvider;
  fetchImpl?: FetchLike;
  skipStoreEnvCheck?: boolean;
}): CreatedServer {
  if (!opts?.skipStoreEnvCheck) assertStoreEnv();
  const runtime = createRuntimeContext({ provider: opts?.provider, fetchImpl: opts?.fetchImpl });
  const server = new McpServer({ name: "rentopc-shopify-mcp", version: "2.0.0" });
  const toolContext = registerAllTools(server, runtime);
  return { server, toolContext, runtime };
}
