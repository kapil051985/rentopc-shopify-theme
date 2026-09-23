import test from "node:test";
import assert from "node:assert/strict";
import { redact } from "../audit.js";

test("redact masks secret-like keys", () => {
  const out = redact({
    client_secret: "supersecret",
    access_token: "shpat_abc",
    password: "hunter2",
    Authorization: "Bearer x",
    apiKey: "k",
    title: "Safe Title",
  }) as Record<string, unknown>;
  assert.equal(out.client_secret, "[REDACTED]");
  assert.equal(out.access_token, "[REDACTED]");
  assert.equal(out.password, "[REDACTED]");
  assert.equal(out.Authorization, "[REDACTED]");
  assert.equal(out.apiKey, "[REDACTED]");
  assert.equal(out.title, "Safe Title");
});

test("redact masks token-shaped strings anywhere", () => {
  const out = redact({ note: "token is shpat_ABC123def and more" }) as { note: string };
  assert.ok(out.note.includes("[REDACTED_TOKEN]"));
  assert.ok(!out.note.includes("shpat_ABC123def"));
});

test("redact recurses into arrays and nested objects", () => {
  const out = redact({ items: [{ secret: "x" }, { ok: 1 }] }) as { items: Record<string, unknown>[] };
  assert.equal(out.items[0].secret, "[REDACTED]");
  assert.equal(out.items[1].ok, 1);
});
