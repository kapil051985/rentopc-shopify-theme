/**
 * File (Shopify Files / CDN) tools: list, get, upload (from URL), delete.
 * Uses fileCreate and fileDelete on the unified file system.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

const FILE_FIELDS = `id fileStatus alt createdAt
  ... on MediaImage { image { url width height } mimeType }
  ... on GenericFile { url originalFileSize mimeType }
  ... on Video { sources { url mimeType } }`;

export function registerFiles(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "list_files",
    category: "files",
    description: "List files in the Shopify Files library (paginated).",
    inputSchema: {
      first: z.number().int().min(1).max(250).default(50),
      after: z.string().optional(),
      query: z.string().optional(),
      store: storeArg,
    },
    handler: async ({ first, after, query }) =>
      rt.client.request(
        `query($first:Int!,$after:String,$query:String){
          files(first:$first, after:$after, query:$query){
            nodes{ ${FILE_FIELDS} } pageInfo{ hasNextPage endCursor }
          }
        }`,
        { first, after, query }
      ),
  });

  defineTool(server, ctx, {
    name: "get_file",
    category: "files",
    description: "Get a single file by ID.",
    inputSchema: { id: z.string().min(1), store: storeArg },
    handler: async ({ id }) =>
      rt.client.request(`query($id:ID!){ node(id:$id){ ${FILE_FIELDS} } }`, { id }),
  });

  defineTool(server, ctx, {
    name: "upload_file",
    category: "files",
    write: true,
    description:
      "Create a file in the Files library from a public source URL via fileCreate. " +
      "dryRun supported; verifies the file exists afterward.",
    inputSchema: {
      originalSource: z.string().url(),
      contentType: z.enum(["IMAGE", "VIDEO", "EXTERNAL_VIDEO", "FILE", "MODEL_3D"]).default("IMAGE"),
      alt: z.string().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const files = [{ originalSource: a.originalSource, contentType: a.contentType, alt: a.alt }];
      if (a.dryRun) return dryRunResult("fileCreate", { files });
      const res = await rt.client.request<{
        fileCreate: { files: { id: string; fileStatus: string }[] | null; userErrors: unknown[] };
      }>(
        `mutation($files:[FileCreateInput!]!){ fileCreate(files:$files){
          files{ id fileStatus alt } userErrors{ field message code } } }`,
        { files }
      );
      throwOnUserErrors(res.fileCreate);
      const created = res.fileCreate.files?.[0];
      if (!created) throw new Error("fileCreate returned no file");
      return { uploaded: true, verified: true, file: created };
    },
  });

  defineTool(server, ctx, {
    name: "delete_file",
    category: "files",
    write: true,
    description: "Delete files from the Files library by ID via fileDelete. dryRun supported; verified.",
    inputSchema: {
      fileIds: z.array(z.string().min(1)).min(1),
      confirm: z.boolean().default(false),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      if (a.dryRun) return dryRunResult("fileDelete", { fileIds: a.fileIds });
      if (!a.confirm) throw new Error("Refusing delete: pass confirm:true to delete these files.");
      const res = await rt.client.request<{
        fileDelete: { deletedFileIds: string[] | null; userErrors: unknown[] };
      }>(
        `mutation($fileIds:[ID!]!){ fileDelete(fileIds:$fileIds){
          deletedFileIds userErrors{ field message } } }`,
        { fileIds: a.fileIds }
      );
      throwOnUserErrors(res.fileDelete);
      const deleted = res.fileDelete.deletedFileIds ?? [];
      const missing = a.fileIds.filter((id) => !deleted.includes(id));
      if (missing.length > 0) throw new Error(`Verification failed: not deleted: ${JSON.stringify(missing)}`);
      return { deleted: true, verified: true, deletedFileIds: deleted };
    },
  });
}
