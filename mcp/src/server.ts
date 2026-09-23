/**
 * RentOPC Shopify MCP — stdio entrypoint.
 *
 * Hard-locked to kvkvw7-dg.myshopify.com. Uses Shopify Client Credentials
 * Grant (preferred) or a legacy static token. All Shopify operations go
 * through the modular tools registered in ./tools.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./createServer.js";

async function main(): Promise<void> {
  const { server } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Note: never write the token/secret anywhere. Startup diagnostics go to
  // stderr only and contain no credentials.
  process.stderr.write("[rentopc-shopify-mcp] connected (store-locked, stdio)\n");
}

main().catch((err) => {
  process.stderr.write(
    `[rentopc-shopify-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
