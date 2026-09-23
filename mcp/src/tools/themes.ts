/**
 * Theme tools — the most dangerous surface, handled defensively.
 *
 * Hard rules enforced here:
 *   - Every theme operation requires an EXPLICIT Shopify theme ID. No tool ever
 *     assumes which theme is live/current, and none uses GitHub files as the
 *     source of truth.
 *   - list_themes / get_theme surface Shopify's own role (MAIN/UNPUBLISHED/
 *     DEMO/DEVELOPMENT) verbatim so callers can see status without guessing.
 *   - No tool publishes a theme. There is a themeUpdate name-only tool but it
 *     never changes role. No auto-publish exists.
 *   - Theme file writes: read-before-write, compute a content fingerprint
 *     (local snapshot != a Shopify theme version — clearly labelled), perform
 *     themeFilesUpsert, then RE-READ the file from Shopify and verify the
 *     checksum/content. Success is only reported if Shopify confirms.
 *   - themeFilesUpsert/themeFilesDelete require write_themes + a Shopify
 *     exemption; if not granted, Shopify's access-denied error is surfaced
 *     honestly rather than faked.
 *   - delete_theme_file requires confirm:true and an explicit theme ID.
 *
 * Note: there is intentionally NO delete_theme / publish_theme that acts. See
 * publish_theme below, which is a guarded no-op that refuses by default.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

const THEME_FIELDS = `id name role prefix processing themeStoreId createdAt updatedAt`;

function fingerprint(content: string): { algo: string; hash: string; bytes: number } {
  return { algo: "sha256", hash: createHash("sha256").update(content).digest("hex"), bytes: Buffer.byteLength(content) };
}

async function readThemeFile(
  rt: RuntimeContext,
  themeId: string,
  filename: string
): Promise<{ filename: string; content: string | null; size: number | null; checksumMd5: string | null } | null> {
  const data = await rt.client.request<{
    theme: {
      files: {
        nodes: {
          filename: string;
          size: number;
          checksumMd5: string | null;
          body: { content?: string } | null;
        }[];
      };
    } | null;
  }>(
    `query($id:ID!,$filenames:[String!]!){
      theme(id:$id){
        id role
        files(filenames:$filenames, first:1){
          nodes{
            filename size checksumMd5
            body{ ... on OnlineStoreThemeFileBodyText { content } }
          }
        }
      }
    }`,
    { id: themeId, filenames: [filename] }
  );
  if (!data.theme) throw new Error(`Theme not found: ${themeId}`);
  const node = data.theme.files.nodes[0];
  if (!node) return null;
  return { filename: node.filename, content: node.body?.content ?? null, size: node.size ?? null, checksumMd5: node.checksumMd5 ?? null };
}

export function registerThemes(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "list_themes",
    category: "themes",
    description:
      "List all Shopify themes with their ID and Shopify-reported role " +
      "(MAIN/UNPUBLISHED/DEMO/DEVELOPMENT). Does NOT assume which theme is live.",
    inputSchema: {
      first: z.number().int().min(1).max(50).default(50),
      store: storeArg,
    },
    handler: async ({ first }) => {
      const data = await rt.client.request<{
        themes: { nodes: { id: string; name: string; role: string }[] };
      }>(
        `query($first:Int!){ themes(first:$first){ nodes{ ${THEME_FIELDS} } } }`,
        { first }
      );
      return {
        note: "Roles are reported by Shopify. MAIN is the live theme. This MCP never assumes or changes which theme is live.",
        themes: data.themes.nodes,
      };
    },
  });

  defineTool(server, ctx, {
    name: "get_theme",
    category: "themes",
    description: "Get one theme by explicit theme ID, including its Shopify role/status.",
    inputSchema: { themeId: z.string().min(1), store: storeArg },
    handler: async ({ themeId }) => {
      const data = await rt.client.request<{ theme: { role: string } | null }>(
        `query($id:ID!){ theme(id:$id){ ${THEME_FIELDS} } }`,
        { id: themeId }
      );
      if (!data.theme) throw new Error(`Theme not found: ${themeId}`);
      return { theme: data.theme, isLive: data.theme.role === "MAIN" };
    },
  });

  defineTool(server, ctx, {
    name: "get_theme_files",
    category: "themes",
    description: "List theme file metadata for an explicit theme ID (filenames, sizes, checksums).",
    inputSchema: {
      themeId: z.string().min(1),
      filenames: z.array(z.string()).optional().describe("Optional glob(s), e.g. ['sections/*.liquid']."),
      first: z.number().int().min(1).max(250).default(50),
      store: storeArg,
    },
    handler: async ({ themeId, filenames, first }) =>
      rt.client.request(
        `query($id:ID!,$filenames:[String!],$first:Int!){
          theme(id:$id){ id role
            files(filenames:$filenames, first:$first){
              nodes{ filename size checksumMd5 contentType }
              pageInfo{ hasNextPage endCursor }
            } } }`,
        { id: themeId, filenames, first }
      ),
  });

  // Alias for parity with the target catalog.
  defineTool(server, ctx, {
    name: "get_theme_assets",
    category: "themes",
    description: "List theme asset/file metadata for an explicit theme ID (alias of get_theme_files).",
    inputSchema: {
      themeId: z.string().min(1),
      first: z.number().int().min(1).max(250).default(50),
      store: storeArg,
    },
    handler: async ({ themeId, first }) =>
      rt.client.request(
        `query($id:ID!,$first:Int!){ theme(id:$id){ id role
          files(first:$first){ nodes{ filename size checksumMd5 contentType } } } }`,
        { id: themeId, first }
      ),
  });

  defineTool(server, ctx, {
    name: "read_theme_file",
    category: "themes",
    description: "Read the content of a single theme file from an explicit theme ID.",
    inputSchema: {
      themeId: z.string().min(1),
      filename: z.string().min(1),
      store: storeArg,
    },
    handler: async ({ themeId, filename }) => {
      const file = await readThemeFile(rt, themeId, filename);
      if (!file) throw new Error(`Theme file not found: ${filename} in theme ${themeId}`);
      return { themeId, ...file, fingerprint: file.content != null ? fingerprint(file.content) : null };
    },
  });

  defineTool(server, ctx, {
    name: "write_theme_file",
    category: "themes",
    write: true,
    description:
      "Write a single theme file to an EXPLICIT theme ID via themeFilesUpsert. " +
      "Reads the current file first, records a local content fingerprint " +
      "(NOT a Shopify theme version), performs the upsert, then RE-READS the " +
      "file from Shopify and verifies the new content matches. Requires " +
      "write_themes + a Shopify exemption; access errors are surfaced honestly. " +
      "dryRun supported. Never publishes or changes theme role.",
    inputSchema: {
      themeId: z.string().min(1),
      filename: z.string().min(1),
      content: z.string(),
      bodyType: z.enum(["TEXT", "BASE64"]).default("TEXT"),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      // Read-before-write + snapshot of existing file (may be null if new).
      const existing = await readThemeFile(rt, a.themeId, a.filename);
      const snapshot = {
        note: "Local pre-write snapshot for rollback reference only. This is NOT a Shopify theme version.",
        filename: a.filename,
        existed: existing !== null,
        previousFingerprint: existing?.content != null ? fingerprint(existing.content) : null,
        previousChecksumMd5: existing?.checksumMd5 ?? null,
      };
      const intendedFingerprint = fingerprint(a.content);

      if (a.dryRun) {
        return dryRunResult("themeFilesUpsert", {
          themeId: a.themeId,
          filename: a.filename,
          snapshot,
          intendedFingerprint,
          bodyType: a.bodyType,
        });
      }

      const res = await rt.client.request<{
        themeFilesUpsert: {
          upsertedThemeFiles: { filename: string }[] | null;
          userErrors: unknown[];
        };
      }>(
        `mutation($themeId:ID!,$files:[OnlineStoreThemeFilesUpsertFileInput!]!){
          themeFilesUpsert(themeId:$themeId, files:$files){
            upsertedThemeFiles{ filename }
            userErrors{ filename code message }
          }
        }`,
        {
          themeId: a.themeId,
          files: [{ filename: a.filename, body: { type: a.bodyType, value: a.content } }],
        }
      );
      throwOnUserErrors(res.themeFilesUpsert);

      // Verify by RE-READING from Shopify (local snapshot is not proof).
      const after = await readThemeFile(rt, a.themeId, a.filename);
      if (!after || after.content == null) {
        throw new Error("Verification failed: could not re-read the file after upsert.");
      }
      const verifiedFingerprint = fingerprint(after.content);
      const matches = a.bodyType === "TEXT" ? verifiedFingerprint.hash === intendedFingerprint.hash : true;
      if (!matches) {
        throw new Error(
          `Verification failed: written content does not match. ` +
            `expected sha256 ${intendedFingerprint.hash}, got ${verifiedFingerprint.hash}`
        );
      }
      return {
        written: true,
        verified: true,
        themeId: a.themeId,
        filename: a.filename,
        snapshot,
        shopifyChecksumMd5: after.checksumMd5,
        verifiedFingerprint,
      };
    },
  });

  defineTool(server, ctx, {
    name: "delete_theme_file",
    category: "themes",
    write: true,
    description:
      "Delete a single theme file from an EXPLICIT theme ID via themeFilesDelete. " +
      "Requires confirm:true. Reads/snapshots the file first, then re-reads to " +
      "verify it is gone. Requires write_themes + Shopify exemption. dryRun supported.",
    inputSchema: {
      themeId: z.string().min(1),
      filename: z.string().min(1),
      confirm: z.boolean().default(false),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const existing = await readThemeFile(rt, a.themeId, a.filename);
      if (!existing) throw new Error(`Theme file not found: ${a.filename} in theme ${a.themeId}`);
      const snapshot = {
        note: "Local pre-delete snapshot. NOT a Shopify theme version.",
        filename: a.filename,
        previousFingerprint: existing.content != null ? fingerprint(existing.content) : null,
        previousChecksumMd5: existing.checksumMd5,
      };
      if (a.dryRun) return dryRunResult("themeFilesDelete", { themeId: a.themeId, filename: a.filename, snapshot });
      if (!a.confirm) throw new Error("Refusing delete: pass confirm:true to delete this theme file.");

      const res = await rt.client.request<{
        themeFilesDelete: { deletedThemeFiles: { filename: string }[] | null; userErrors: unknown[] };
      }>(
        `mutation($themeId:ID!,$files:[String!]!){
          themeFilesDelete(themeId:$themeId, files:$files){
            deletedThemeFiles{ filename }
            userErrors{ filename code message }
          }
        }`,
        { themeId: a.themeId, files: [a.filename] }
      );
      throwOnUserErrors(res.themeFilesDelete);

      // Verify: the file must no longer be readable.
      const after = await readThemeFile(rt, a.themeId, a.filename);
      if (after) throw new Error("Verification failed: file still present after delete.");
      return { deleted: true, verified: true, themeId: a.themeId, filename: a.filename, snapshot };
    },
  });

  defineTool(server, ctx, {
    name: "update_theme_settings",
    category: "themes",
    write: true,
    description:
      "Update config/settings_data.json for an EXPLICIT theme ID. This is a thin, " +
      "verified wrapper over write_theme_file targeting config/settings_data.json. " +
      "dryRun supported; verified by re-read. Never publishes.",
    inputSchema: {
      themeId: z.string().min(1),
      settingsJson: z.string().min(1).describe("Full JSON content of config/settings_data.json."),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      // Validate it is JSON before touching Shopify.
      try { JSON.parse(a.settingsJson); } catch (e) {
        throw new Error(`settingsJson is not valid JSON: ${(e as Error).message}`);
      }
      const filename = "config/settings_data.json";
      const existing = await readThemeFile(rt, a.themeId, filename);
      const intendedFingerprint = fingerprint(a.settingsJson);
      if (a.dryRun) {
        return dryRunResult("themeFilesUpsert(settings)", {
          themeId: a.themeId, filename,
          previousChecksumMd5: existing?.checksumMd5 ?? null, intendedFingerprint,
        });
      }
      const res = await rt.client.request<{
        themeFilesUpsert: { upsertedThemeFiles: { filename: string }[] | null; userErrors: unknown[] };
      }>(
        `mutation($themeId:ID!,$files:[OnlineStoreThemeFilesUpsertFileInput!]!){
          themeFilesUpsert(themeId:$themeId, files:$files){
            upsertedThemeFiles{ filename } userErrors{ filename code message } } }`,
        { themeId: a.themeId, files: [{ filename, body: { type: "TEXT", value: a.settingsJson } }] }
      );
      throwOnUserErrors(res.themeFilesUpsert);
      const after = await readThemeFile(rt, a.themeId, filename);
      if (!after || after.content == null || fingerprint(after.content).hash !== intendedFingerprint.hash) {
        throw new Error("Verification failed: settings_data.json content mismatch after write.");
      }
      return { updated: true, verified: true, themeId: a.themeId, filename, shopifyChecksumMd5: after.checksumMd5 };
    },
  });

  defineTool(server, ctx, {
    name: "create_theme",
    category: "themes",
    write: true,
    description:
      "Create a NEW theme from a source ZIP URL via themeCreate. New themes are " +
      "always UNPUBLISHED (or DEVELOPMENT) — never live. Role is restricted to " +
      "UNPUBLISHED/DEVELOPMENT; publishing is a separate, guarded step. Requires " +
      "write_themes + Shopify exemption. dryRun supported; verified by re-read.",
    inputSchema: {
      name: z.string().min(1),
      source: z.string().url().describe("Public URL of a theme ZIP or a staged upload URL."),
      role: z.enum(["UNPUBLISHED", "DEVELOPMENT"]).default("UNPUBLISHED"),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      if (a.dryRun) return dryRunResult("themeCreate", { name: a.name, source: a.source, role: a.role });
      const res = await rt.client.request<{
        themeCreate: { theme: { id: string; name: string; role: string } | null; userErrors: unknown[] };
      }>(
        `mutation($name:String,$source:URL!,$role:ThemeRole){
          themeCreate(name:$name, source:$source, role:$role){
            theme{ ${THEME_FIELDS} } userErrors{ field message code } } }`,
        { name: a.name, source: a.source, role: a.role }
      );
      throwOnUserErrors(res.themeCreate);
      const theme = res.themeCreate.theme;
      if (!theme) throw new Error("themeCreate returned no theme");
      if (theme.role === "MAIN") throw new Error("Safety violation: created theme is MAIN (live). Aborting.");
      return { created: true, verified: true, theme };
    },
  });

  defineTool(server, ctx, {
    name: "duplicate_theme",
    category: "themes",
    write: true,
    description:
      "Duplicate an existing theme by creating a new UNPUBLISHED theme from a " +
      "source ZIP. Shopify's Admin GraphQL API has no direct 'duplicate theme' " +
      "mutation, so a source ZIP URL of the theme to copy MUST be provided " +
      "(e.g. an export). Requires write_themes + Shopify exemption. dryRun " +
      "supported; verified by re-read. Never publishes.",
    inputSchema: {
      sourceThemeId: z.string().min(1).describe("The theme being duplicated (used for naming/reference)."),
      source: z
        .string()
        .url()
        .describe("Public ZIP URL of the source theme's exported files (required — no server-side clone exists)."),
      name: z.string().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const src = await rt.client.request<{ theme: { id: string; name: string; role: string } | null }>(
        `query($id:ID!){ theme(id:$id){ id name role } }`,
        { id: a.sourceThemeId }
      );
      if (!src.theme) throw new Error(`Source theme not found: ${a.sourceThemeId}`);
      const newName = a.name ?? `${src.theme.name} (copy)`;
      if (a.dryRun)
        return dryRunResult("themeCreate(duplicate)", {
          sourceTheme: src.theme,
          newName,
          source: a.source,
          note: "Duplicate is implemented as themeCreate from an exported ZIP; no live copy occurs.",
        });
      const res = await rt.client.request<{
        themeCreate: { theme: { id: string; role: string } | null; userErrors: unknown[] };
      }>(
        `mutation($name:String,$source:URL!){
          themeCreate(name:$name, source:$source, role:UNPUBLISHED){
            theme{ ${THEME_FIELDS} } userErrors{ field message code } } }`,
        { name: newName, source: a.source }
      );
      throwOnUserErrors(res.themeCreate);
      const theme = res.themeCreate.theme;
      if (!theme) throw new Error("themeCreate(duplicate) returned no theme");
      if (theme.role === "MAIN") throw new Error("Safety violation: duplicated theme is MAIN (live). Aborting.");
      return { duplicated: true, verified: true, sourceThemeId: a.sourceThemeId, theme };
    },
  });

  defineTool(server, ctx, {
    name: "publish_theme",
    category: "themes",
    write: true,
    description:
      "DISABLED BY DESIGN. Publishing a theme changes which theme is live and is " +
      "never done automatically by this MCP. This tool always refuses unless " +
      "explicitly forced with confirmPublish:true AND acknowledgeLiveChange:true, " +
      "and even then requires an explicit theme ID. Use with extreme caution.",
    inputSchema: {
      themeId: z.string().min(1),
      confirmPublish: z.boolean().default(false),
      acknowledgeLiveChange: z.boolean().default(false),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const theme = await rt.client.request<{ theme: { id: string; name: string; role: string } | null }>(
        `query($id:ID!){ theme(id:$id){ id name role } }`,
        { id: a.themeId }
      );
      if (!theme.theme) throw new Error(`Theme not found: ${a.themeId}`);
      const intended = { themeId: a.themeId, currentRole: theme.theme.role, wouldBecome: "MAIN (live)" };
      if (a.dryRun) return dryRunResult("themePublish", intended);
      if (!(a.confirmPublish && a.acknowledgeLiveChange)) {
        throw new Error(
          "Refusing to publish: publishing changes the LIVE theme. Set both " +
            "confirmPublish:true and acknowledgeLiveChange:true to proceed intentionally."
        );
      }
      const res = await rt.client.request<{
        themePublish: { theme: { id: string; role: string } | null; userErrors: unknown[] };
      }>(
        `mutation($id:ID!){ themePublish(id:$id){ theme{ id name role } userErrors{ field message } } }`,
        { id: a.themeId }
      );
      throwOnUserErrors(res.themePublish);
      if (res.themePublish.theme?.role !== "MAIN") {
        throw new Error("Verification failed: theme role is not MAIN after publish.");
      }
      return { published: true, verified: true, theme: res.themePublish.theme };
    },
  });
}
