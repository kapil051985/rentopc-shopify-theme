/**
 * Test harness to invoke a registered tool exactly the way the MCP runtime
 * would: validate the raw args against the tool's Zod inputSchema, then call
 * the tool handler with the parsed args. Uses a fake fetch — never the network.
 */
import { createServer } from "../createServer.js";
import { ClientCredentialsProvider } from "../auth.js";
import { makeFakeFetch, type FakeResponseSpec, type RecordedCall } from "./helpers.js";

export interface HarnessResult {
  /** Parsed JSON of the tool's text result, if any. */
  data: unknown;
  isError: boolean;
  rawText: string;
  calls: RecordedCall[];
}

export function buildHarness(
  graphqlResponses: Array<FakeResponseSpec | ((call: RecordedCall) => FakeResponseSpec)>
) {
  // First response is always the OAuth token exchange.
  const responses: Array<FakeResponseSpec | ((call: RecordedCall) => FakeResponseSpec)> = [
    { json: { access_token: "tok-test", expires_in: 86400 } },
    ...graphqlResponses,
  ];
  const { fetch, calls } = makeFakeFetch(responses);
  const provider = new ClientCredentialsProvider("id", "secret", "kvkvw7-dg.myshopify.com", fetch);
  const { server } = createServer({ provider, fetchImpl: fetch, skipStoreEnvCheck: true });
  const tools = (server as unknown as {
    _registeredTools: Record<string, { inputSchema?: { parse: (x: unknown) => unknown }; handler: (args: unknown) => Promise<unknown> }>;
  })._registeredTools;

  return {
    calls,
    async call(name: string, rawArgs: Record<string, unknown>): Promise<HarnessResult> {
      const t = tools[name];
      if (!t) throw new Error(`Tool not registered: ${name}`);
      // Mirror runtime: Zod-validate then invoke.
      const parsed = t.inputSchema ? t.inputSchema.parse(rawArgs) : rawArgs;
      const res = (await t.handler(parsed)) as {
        isError?: boolean;
        content: { type: string; text: string }[];
      };
      const text = res.content?.[0]?.text ?? "";
      let data: unknown = undefined;
      try { data = JSON.parse(text); } catch { data = text; }
      return { data, isError: Boolean(res.isError), rawText: text, calls };
    },
    /** Validate raw args against a tool's schema without invoking it. */
    validate(name: string, rawArgs: Record<string, unknown>): unknown {
      const t = tools[name];
      if (!t) throw new Error(`Tool not registered: ${name}`);
      if (!t.inputSchema) throw new Error(`Tool ${name} has no input schema`);
      return t.inputSchema.parse(rawArgs);
    },
  };
}
