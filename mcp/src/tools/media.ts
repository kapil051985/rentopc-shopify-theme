/**
 * Product media tools with STRICT image/video separation.
 *
 * Shopify's productDeleteMedia removes the corresponding product image when
 * you delete IMAGE media, but leaves images untouched when you delete VIDEO
 * media. To make "delete a video without touching product images" safe:
 *
 *   - delete_product_video validates that EVERY targeted media id is VIDEO or
 *     EXTERNAL_VIDEO before issuing the delete. If any id is an IMAGE (or
 *     unknown), it refuses the whole operation.
 *   - delete_product_image is the explicit, separate path for images.
 *   - There is intentionally NO "delete all media" tool.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTool, dryRunArg, dryRunResult, storeArg, type ToolContext } from "../safety.js";
import type { RuntimeContext } from "../context.js";
import { throwOnUserErrors } from "../client.js";

const VIDEO_TYPES = new Set(["VIDEO", "EXTERNAL_VIDEO"]);
const IMAGE_TYPES = new Set(["IMAGE"]);

interface MediaNode {
  id: string;
  mediaContentType: string;
  status?: string;
  alt?: string | null;
}

async function fetchProductMedia(rt: RuntimeContext, productId: string): Promise<MediaNode[]> {
  const data = await rt.client.request<{
    product: { media: { nodes: MediaNode[] } } | null;
  }>(
    `query($id:ID!){
      product(id:$id){
        id
        media(first:250){
          nodes{
            id mediaContentType status alt
            ... on MediaImage { image { url width height } }
            ... on Video { sources { url format mimeType } }
            ... on ExternalVideo { origamiUrl: embedUrl }
          }
        }
      }
    }`,
    { id: productId }
  );
  if (!data.product) throw new Error(`Product not found: ${productId}`);
  return data.product.media.nodes;
}

async function deleteMedia(
  rt: RuntimeContext,
  productId: string,
  mediaIds: string[]
): Promise<{ deletedMediaIds: string[]; deletedProductImageIds: string[] }> {
  const res = await rt.client.request<{
    productDeleteMedia: {
      deletedMediaIds: string[] | null;
      deletedProductImageIds: string[] | null;
      mediaUserErrors: unknown[];
      userErrors: unknown[];
    };
  }>(
    `mutation($productId:ID!,$mediaIds:[ID!]!){
      productDeleteMedia(productId:$productId, mediaIds:$mediaIds){
        deletedMediaIds
        deletedProductImageIds
        mediaUserErrors{ field message }
        userErrors{ field message }
      }
    }`,
    { productId, mediaIds }
  );
  throwOnUserErrors(res.productDeleteMedia);
  return {
    deletedMediaIds: res.productDeleteMedia.deletedMediaIds ?? [],
    deletedProductImageIds: res.productDeleteMedia.deletedProductImageIds ?? [],
  };
}

export function registerMedia(
  server: McpServer,
  ctx: ToolContext,
  rt: RuntimeContext
): void {
  defineTool(server, ctx, {
    name: "get_product_media",
    category: "media",
    description:
      "List all media for a product, classified by type (image, video, other), " +
      "so you can pick exactly which media to act on.",
    inputSchema: { productId: z.string().min(1), store: storeArg },
    handler: async ({ productId }) => {
      const media = await fetchProductMedia(rt, productId);
      return {
        productId,
        counts: {
          images: media.filter((m) => IMAGE_TYPES.has(m.mediaContentType)).length,
          videos: media.filter((m) => VIDEO_TYPES.has(m.mediaContentType)).length,
          other: media.filter(
            (m) => !IMAGE_TYPES.has(m.mediaContentType) && !VIDEO_TYPES.has(m.mediaContentType)
          ).length,
        },
        images: media.filter((m) => IMAGE_TYPES.has(m.mediaContentType)),
        videos: media.filter((m) => VIDEO_TYPES.has(m.mediaContentType)),
        other: media.filter(
          (m) => !IMAGE_TYPES.has(m.mediaContentType) && !VIDEO_TYPES.has(m.mediaContentType)
        ),
      };
    },
  });

  defineTool(server, ctx, {
    name: "add_product_media",
    category: "media",
    write: true,
    description:
      "Attach media (image/video/external video/3D) to a product from a source URL. " +
      "dryRun supported; verifies the media exists on the product afterward.",
    inputSchema: {
      productId: z.string().min(1),
      originalSource: z.string().url().describe("Public URL of the media asset."),
      mediaContentType: z.enum(["IMAGE", "VIDEO", "EXTERNAL_VIDEO", "MODEL_3D"]),
      alt: z.string().optional(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const media = [{ originalSource: a.originalSource, mediaContentType: a.mediaContentType, alt: a.alt }];
      if (a.dryRun) return dryRunResult("productCreateMedia", { productId: a.productId, media });
      const res = await rt.client.request<{
        productCreateMedia: {
          media: { id: string; mediaContentType: string; status: string }[] | null;
          mediaUserErrors: unknown[];
          userErrors: unknown[];
        };
      }>(
        `mutation($productId:ID!,$media:[CreateMediaInput!]!){
          productCreateMedia(productId:$productId, media:$media){
            media{ id mediaContentType status }
            mediaUserErrors{ field message }
            userErrors{ field message }
          }
        }`,
        { productId: a.productId, media }
      );
      throwOnUserErrors(res.productCreateMedia);
      const created = res.productCreateMedia.media?.[0];
      if (!created) throw new Error("productCreateMedia returned no media");
      return { added: true, verified: true, media: created };
    },
  });

  defineTool(server, ctx, {
    name: "update_product_image_alt",
    category: "media",
    write: true,
    description: "Update the alt text of a product IMAGE media. dryRun supported; verified after write.",
    inputSchema: {
      productId: z.string().min(1),
      mediaId: z.string().min(1),
      alt: z.string(),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const media = await fetchProductMedia(rt, a.productId);
      const target = media.find((m) => m.id === a.mediaId);
      if (!target) throw new Error(`Media ${a.mediaId} not found on product ${a.productId}`);
      if (!IMAGE_TYPES.has(target.mediaContentType)) {
        throw new Error(
          `Media ${a.mediaId} is ${target.mediaContentType}, not an image. Refusing.`
        );
      }
      if (a.dryRun) return dryRunResult("productUpdateMedia(alt)", { mediaId: a.mediaId, from: target.alt, to: a.alt });
      const res = await rt.client.request<{
        productUpdateMedia: { media: { id: string; alt: string }[] | null; mediaUserErrors: unknown[] };
      }>(
        `mutation($productId:ID!,$media:[UpdateMediaInput!]!){
          productUpdateMedia(productId:$productId, media:$media){
            media{ id alt }
            mediaUserErrors{ field message }
          }
        }`,
        { productId: a.productId, media: [{ id: a.mediaId, alt: a.alt }] }
      );
      throwOnUserErrors(res.productUpdateMedia);
      const updated = res.productUpdateMedia.media?.[0] as { alt?: string } | undefined;
      if (updated?.alt !== a.alt) throw new Error("Verification failed: alt not updated as expected");
      return { updated: true, verified: true, mediaId: a.mediaId, alt: updated.alt };
    },
  });

  defineTool(server, ctx, {
    name: "delete_product_video",
    category: "media",
    write: true,
    description:
      "Delete ONLY video media (VIDEO / EXTERNAL_VIDEO) from a product. Refuses if " +
      "any supplied media id is an image or unknown type, so product images are " +
      "never removed accidentally. dryRun supported; verifies deletion.",
    inputSchema: {
      productId: z.string().min(1),
      mediaIds: z.array(z.string().min(1)).min(1),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const media = await fetchProductMedia(rt, a.productId);
      const byId = new Map(media.map((m) => [m.id, m]));
      const misclassified: { id: string; type: string }[] = [];
      for (const id of a.mediaIds) {
        const m = byId.get(id);
        if (!m) {
          misclassified.push({ id, type: "NOT_FOUND" });
        } else if (!VIDEO_TYPES.has(m.mediaContentType)) {
          misclassified.push({ id, type: m.mediaContentType });
        }
      }
      if (misclassified.length > 0) {
        throw new Error(
          `Refusing video delete: these ids are not video media: ` +
            `${JSON.stringify(misclassified)}. Use delete_product_image for images.`
        );
      }
      if (a.dryRun)
        return dryRunResult("productDeleteMedia(videos)", {
          productId: a.productId,
          videoMediaIds: a.mediaIds,
        });
      const result = await deleteMedia(rt, a.productId, a.mediaIds);
      // Verify: no image should have been deleted, and videos are gone.
      if (result.deletedProductImageIds.length > 0) {
        throw new Error(
          `Safety violation: image ids were deleted: ${JSON.stringify(result.deletedProductImageIds)}`
        );
      }
      const remaining = await fetchProductMedia(rt, a.productId);
      const stillThere = a.mediaIds.filter((id) => remaining.some((m) => m.id === id));
      if (stillThere.length > 0) throw new Error(`Verification failed: still present: ${stillThere}`);
      return {
        deleted: true,
        verified: true,
        deletedVideoMediaIds: result.deletedMediaIds,
        deletedProductImageIds: result.deletedProductImageIds, // expected empty
      };
    },
  });

  defineTool(server, ctx, {
    name: "delete_media",
    category: "media",
    write: true,
    description:
      "Type-aware media delete dispatcher. Requires an explicit mediaType " +
      "('video' or 'image') and only deletes media of that type after verifying " +
      "every id matches. This is intentionally NOT a blanket 'delete all media' " +
      "operation: it will never delete images when asked to delete videos, or " +
      "vice versa. dryRun supported.",
    inputSchema: {
      productId: z.string().min(1),
      mediaType: z.enum(["video", "image"]).describe("Which media type to delete. No blanket delete is allowed."),
      mediaIds: z.array(z.string().min(1)).min(1),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const media = await fetchProductMedia(rt, a.productId);
      const byId = new Map(media.map((m) => [m.id, m]));
      const allowed = a.mediaType === "video" ? VIDEO_TYPES : IMAGE_TYPES;
      const misclassified: { id: string; type: string }[] = [];
      for (const id of a.mediaIds) {
        const m = byId.get(id);
        if (!m) misclassified.push({ id, type: "NOT_FOUND" });
        else if (!allowed.has(m.mediaContentType)) misclassified.push({ id, type: m.mediaContentType });
      }
      if (misclassified.length > 0) {
        throw new Error(
          `Refusing delete: with mediaType='${a.mediaType}', these ids do not match: ` +
            `${JSON.stringify(misclassified)}.`
        );
      }
      if (a.dryRun)
        return dryRunResult(`productDeleteMedia(${a.mediaType})`, {
          productId: a.productId,
          mediaType: a.mediaType,
          mediaIds: a.mediaIds,
        });
      const result = await deleteMedia(rt, a.productId, a.mediaIds);
      if (a.mediaType === "video" && result.deletedProductImageIds.length > 0) {
        throw new Error(
          `Safety violation: deleting videos removed image ids: ${JSON.stringify(result.deletedProductImageIds)}`
        );
      }
      const remaining = await fetchProductMedia(rt, a.productId);
      const stillThere = a.mediaIds.filter((id) => remaining.some((m) => m.id === id));
      if (stillThere.length > 0) throw new Error(`Verification failed: still present: ${stillThere}`);
      return {
        deleted: true,
        verified: true,
        mediaType: a.mediaType,
        deletedMediaIds: result.deletedMediaIds,
        deletedProductImageIds: result.deletedProductImageIds,
      };
    },
  });

  defineTool(server, ctx, {
    name: "delete_product_image",
    category: "media",
    write: true,
    description:
      "Delete ONLY image media (IMAGE) from a product. Refuses if any supplied id " +
      "is a video/other type. dryRun supported; verifies deletion.",
    inputSchema: {
      productId: z.string().min(1),
      mediaIds: z.array(z.string().min(1)).min(1),
      dryRun: dryRunArg,
      store: storeArg,
    },
    handler: async (a) => {
      const media = await fetchProductMedia(rt, a.productId);
      const byId = new Map(media.map((m) => [m.id, m]));
      const misclassified: { id: string; type: string }[] = [];
      for (const id of a.mediaIds) {
        const m = byId.get(id);
        if (!m) misclassified.push({ id, type: "NOT_FOUND" });
        else if (!IMAGE_TYPES.has(m.mediaContentType)) misclassified.push({ id, type: m.mediaContentType });
      }
      if (misclassified.length > 0) {
        throw new Error(
          `Refusing image delete: these ids are not image media: ${JSON.stringify(misclassified)}. ` +
            `Use delete_product_video for videos.`
        );
      }
      if (a.dryRun)
        return dryRunResult("productDeleteMedia(images)", { productId: a.productId, imageMediaIds: a.mediaIds });
      const result = await deleteMedia(rt, a.productId, a.mediaIds);
      const remaining = await fetchProductMedia(rt, a.productId);
      const stillThere = a.mediaIds.filter((id) => remaining.some((m) => m.id === id));
      if (stillThere.length > 0) throw new Error(`Verification failed: still present: ${stillThere}`);
      return {
        deleted: true,
        verified: true,
        deletedMediaIds: result.deletedMediaIds,
        deletedProductImageIds: result.deletedProductImageIds,
      };
    },
  });
}
