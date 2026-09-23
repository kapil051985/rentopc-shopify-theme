import test from "node:test";
import assert from "node:assert/strict";
import { buildHarness } from "./harness.js";

test("list_themes surfaces Shopify roles and never assumes live", async () => {
  const h = buildHarness([
    {
      json: {
        data: {
          themes: {
            nodes: [
              { id: "gid://shopify/OnlineStoreTheme/1", name: "Live", role: "MAIN" },
              { id: "gid://shopify/OnlineStoreTheme/2", name: "Backup", role: "UNPUBLISHED" },
            ],
          },
        },
      },
    },
  ]);
  const res = await h.call("list_themes", {});
  const data = res.data as { note: string; themes: { role: string }[] };
  assert.match(data.note, /never assumes/i);
  assert.equal(data.themes.length, 2);
});

test("theme tools require an explicit themeId (zod)", () => {
  const h = buildHarness([]);
  assert.throws(() => h.validate("get_theme", {}));
  assert.throws(() => h.validate("read_theme_file", { filename: "x" }));
  assert.throws(() => h.validate("write_theme_file", { filename: "x", content: "y" }));
  assert.throws(() => h.validate("delete_theme_file", { filename: "x" }));
});

test("write_theme_file: read-before-write, snapshot, and re-read verification", async () => {
  const themeId = "gid://shopify/OnlineStoreTheme/2";
  const newContent = "<h1>hello</h1>";
  const h = buildHarness([
    // read-before-write (existing content)
    {
      json: {
        data: {
          theme: {
            role: "UNPUBLISHED",
            files: { nodes: [{ filename: "snippets/x.liquid", size: 3, checksumMd5: "old", body: { content: "old" } }] },
          },
        },
      },
    },
    // upsert
    { json: { data: { themeFilesUpsert: { upsertedThemeFiles: [{ filename: "snippets/x.liquid" }], userErrors: [] } } } },
    // re-read verification (new content)
    {
      json: {
        data: {
          theme: {
            role: "UNPUBLISHED",
            files: { nodes: [{ filename: "snippets/x.liquid", size: 14, checksumMd5: "new", body: { content: newContent } }] },
          },
        },
      },
    },
  ]);
  const res = await h.call("write_theme_file", {
    themeId, filename: "snippets/x.liquid", content: newContent,
  });
  assert.equal(res.isError, false, res.rawText);
  const data = res.data as { written: boolean; verified: boolean; snapshot: { existed: boolean } };
  assert.equal(data.written, true);
  assert.equal(data.verified, true);
  assert.equal(data.snapshot.existed, true, "must record a pre-write snapshot");
});

test("write_theme_file FAILS verification when re-read content mismatches", async () => {
  const themeId = "gid://shopify/OnlineStoreTheme/2";
  const h = buildHarness([
    { json: { data: { theme: { role: "UNPUBLISHED", files: { nodes: [] } } } } }, // new file
    { json: { data: { themeFilesUpsert: { upsertedThemeFiles: [{ filename: "a.txt" }], userErrors: [] } } } },
    // re-read returns DIFFERENT content
    { json: { data: { theme: { role: "UNPUBLISHED", files: { nodes: [{ filename: "a.txt", size: 5, checksumMd5: "z", body: { content: "WRONG" } }] } } } } },
  ]);
  const res = await h.call("write_theme_file", { themeId, filename: "a.txt", content: "RIGHT" });
  assert.equal(res.isError, true);
  assert.match(res.rawText, /Verification failed/i);
});

test("write_theme_file surfaces themeFilesUpsert access errors honestly (no fake success)", async () => {
  const themeId = "gid://shopify/OnlineStoreTheme/2";
  const h = buildHarness([
    { json: { data: { theme: { role: "UNPUBLISHED", files: { nodes: [] } } } } },
    {
      json: {
        data: {
          themeFilesUpsert: {
            upsertedThemeFiles: [],
            userErrors: [{ filename: "a.txt", code: "ACCESS_DENIED", message: "needs write_themes and an exemption" }],
          },
        },
      },
    },
  ]);
  const res = await h.call("write_theme_file", { themeId, filename: "a.txt", content: "x" });
  assert.equal(res.isError, true);
  assert.match(res.rawText, /write_themes|ACCESS_DENIED/i);
});

test("publish_theme refuses without explicit double-confirmation", async () => {
  const themeId = "gid://shopify/OnlineStoreTheme/2";
  const h = buildHarness([
    { json: { data: { theme: { id: themeId, name: "Backup", role: "UNPUBLISHED" } } } },
  ]);
  const res = await h.call("publish_theme", { themeId });
  assert.equal(res.isError, true);
  assert.match(res.rawText, /Refusing to publish/i);
  // No publish mutation issued.
  const pub = h.calls.filter((c) => /themePublish/i.test(String((c.body as { query?: string })?.query)));
  assert.equal(pub.length, 0);
});

test("create_theme produces a non-live theme (never MAIN)", async () => {
  const h = buildHarness([
    { json: { data: { themeCreate: { theme: { id: "gid://shopify/OnlineStoreTheme/9", name: "New", role: "UNPUBLISHED" }, userErrors: [] } } } },
  ]);
  const res = await h.call("create_theme", { name: "New", source: "https://example.com/theme.zip" });
  assert.equal(res.isError, false, res.rawText);
  const data = res.data as { created: boolean; theme: { role: string } };
  assert.equal(data.created, true);
  assert.notEqual(data.theme.role, "MAIN");
});
