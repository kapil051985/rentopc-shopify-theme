/**
 * Test helpers: a scriptable fake fetch and a controllable clock.
 * No test in this repo ever performs a real network / Shopify call.
 */
import type { FetchLike } from "../auth.js";

export interface FakeResponseSpec {
  status?: number;
  json?: unknown;
  text?: string;
}

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Build a fake fetch that returns queued responses in order. Each entry may be
 * a static spec or a function of the recorded call.
 */
export function makeFakeFetch(
  responses: Array<FakeResponseSpec | ((call: RecordedCall) => FakeResponseSpec)>
): { fetch: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let i = 0;
  const fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    const h = init?.headers as Record<string, string> | undefined;
    if (h) for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = String(v);
    let body: unknown = init?.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* form-encoded or plain */ }
    } else if (body instanceof URLSearchParams) {
      body = Object.fromEntries(body.entries());
    }
    const call: RecordedCall = { url, method: init?.method ?? "GET", headers, body };
    calls.push(call);

    const specOrFn = responses[Math.min(i, responses.length - 1)];
    i++;
    const spec = typeof specOrFn === "function" ? specOrFn(call) : specOrFn;
    const status = spec.status ?? 200;
    const text = spec.text ?? JSON.stringify(spec.json ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      async text() { return text; },
      async json() { return JSON.parse(text); },
    } as unknown as Response;
  }) as unknown as FetchLike;
  return { fetch, calls };
}

/** A controllable clock for testing token expiry. */
export function makeClock(start = 1_000_000): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}
