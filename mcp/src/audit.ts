/**
 * Lightweight local audit trail.
 *
 * Records tool invocations (name, dryRun, outcome, redacted summary) to an
 * in-memory ring buffer and optionally to stderr. It NEVER records tokens,
 * secrets, passwords, or credentials — values are passed through a redactor
 * before being stored.
 */

const SENSITIVE_KEY = /(secret|token|password|client_secret|authorization|access_token|api[_-]?key)/i;

export interface AuditEntry {
  ts: string;
  tool: string;
  dryRun: boolean;
  outcome: "success" | "error" | "dry-run";
  detail?: string;
}

/** Recursively redact sensitive values from an object for safe logging. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[…]";
  if (value == null) return value;
  if (typeof value === "string") {
    // Redact anything that looks like a Shopify token.
    return value.replace(/shp(at|ca|ss|pa)_[A-Za-z0-9]+/g, "[REDACTED_TOKEN]");
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

const RING_MAX = 500;
const ring: AuditEntry[] = [];

export function audit(entry: Omit<AuditEntry, "ts">): void {
  const full: AuditEntry = { ts: new Date().toISOString(), ...entry };
  ring.push(full);
  if (ring.length > RING_MAX) ring.shift();
  if (process.env.RENTOPC_MCP_AUDIT_STDERR === "1") {
    process.stderr.write(`[audit] ${JSON.stringify(full)}\n`);
  }
}

export function getAuditLog(): readonly AuditEntry[] {
  return ring;
}
