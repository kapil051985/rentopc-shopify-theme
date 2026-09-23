/**
 * Safety and registration helpers shared by all tools.
 *
 * The `defineTool` helper standardizes:
 *   - Zod input validation (via registerTool inputSchema)
 *   - store-guard enforcement (if the tool declares a store arg)
 *   - structured error handling (errors become isError tool results, not throws)
 *   - audit logging with redaction
 *
 * The `dryRunResult` helper standardizes dry-run payloads for write tools.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodRawShape } from "zod";
import { assertStoreGuard } from "./store.js";
import { audit, redact } from "./audit.js";

export interface ToolContext {
  /** Registry of tool metadata for diagnostics/self-test. */
  registered: RegisteredToolInfo[];
}

export interface RegisteredToolInfo {
  name: string;
  description: string;
  write: boolean;
  category: string;
}

/** Common Zod field reused by tools that accept an explicit store (guarded). */
export const storeArg = z
  .string()
  .optional()
  .describe("Optional store domain; must equal the locked store if supplied.");

/** Common dry-run field for write tools. */
export const dryRunArg = z
  .boolean()
  .default(false)
  .describe("If true, do not mutate Shopify; return the intended change only.");

export interface DefineToolOptions<S extends ZodRawShape> {
  name: string;
  description: string;
  category: string;
  /** Whether this tool performs a write/mutation. */
  write?: boolean;
  inputSchema: S;
  handler: (args: z.objectOutputType<S, z.ZodTypeAny>) => Promise<unknown>;
}

/**
 * Register a tool on the MCP server with validation, store guard, audit,
 * and consistent error surfacing.
 */
export function defineTool<S extends ZodRawShape>(
  server: McpServer,
  ctx: ToolContext,
  opts: DefineToolOptions<S>
): void {
  const write = opts.write ?? false;
  ctx.registered.push({
    name: opts.name,
    description: opts.description,
    write,
    category: opts.category,
  });

  // The SDK validates args against inputSchema (Zod) before invoking us, then
  // passes the parsed args. We wrap in guard/audit/error handling. The callback
  // is cast to the SDK's generic ToolCallback shape.
  const callback = async (args: Record<string, unknown>) => {
    const dryRun = Boolean((args as { dryRun?: boolean }).dryRun);
    try {
      // Enforce the store guard whenever a store-like arg is present.
      const store = (args as { store?: string }).store;
      if (store !== undefined) assertStoreGuard(store);

      const result = await opts.handler(args as never);
      audit({
        tool: opts.name,
        dryRun,
        outcome: dryRun && write ? "dry-run" : "success",
        detail: summarize(result),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ tool: opts.name, dryRun, outcome: "error", detail: message });
      return {
        isError: true,
        content: [{ type: "text" as const, text: message }],
      };
    }
  };

  server.registerTool(
    opts.name,
    { description: opts.description, inputSchema: opts.inputSchema },
    callback as unknown as Parameters<typeof server.registerTool>[2]
  );
}

function summarize(result: unknown): string {
  try {
    const s = JSON.stringify(redact(result));
    return s.length > 300 ? `${s.slice(0, 300)}…` : s;
  } catch {
    return "[unserializable result]";
  }
}

/** Build a standard dry-run response envelope. */
export function dryRunResult(
  operation: string,
  intended: Record<string, unknown>
): Record<string, unknown> {
  return {
    dryRun: true,
    operation,
    wouldChange: intended,
    note: "No changes were sent to Shopify. Re-run with dryRun:false to apply.",
  };
}
