import test from "node:test";
import assert from "node:assert/strict";
import { buildHarness } from "./harness.js";

const PRODUCT_MEDIA = {
  data: {
    product: {
      id: "p1",
      media: {
        nodes: [
          { id: "gid://shopify/MediaImage/1", mediaContentType: "IMAGE", status: "READY", alt: "img" },
          { id: "gid://shopify/Video/2", mediaContentType: "VIDEO", status: "READY", alt: "vid" },
          { id: "gid://shopify/ExternalVideo/3", mediaContentType: "EXTERNAL_VIDEO", status: "READY", alt: "ext" },
        ],
      },
    },
  },
};

test("get_product_media classifies media into images/videos/other", async () => {
  const h = buildHarness([{ json: PRODUCT_MEDIA }]);
  const res = await h.call("get_product_media", { productId: "p1" });
  const data = res.data as { counts: { images: number; videos: number; other: number } };
  assert.equal(data.counts.images, 1);
  assert.equal(data.counts.videos, 2);
  assert.equal(data.counts.other, 0);
});

test("delete_product_video REFUSES when an image id is included (protects images)", async () => {
  const h = buildHarness([{ json: PRODUCT_MEDIA }]);
  const res = await h.call("delete_product_video", {
    productId: "p1",
    mediaIds: ["gid://shopify/Video/2", "gid://shopify/MediaImage/1"], // one image sneaked in
  });
  assert.equal(res.isError, true);
  assert.match(res.rawText, /not video media/i);
  // Crucially, NO delete mutation was sent.
  const mutationCalls = h.calls.filter((c) => /productDeleteMedia/i.test(String((c.body as { query?: string })?.query)));
  assert.equal(mutationCalls.length, 0, "must not attempt deletion when an image is present");
});

test("delete_product_video deletes only videos and verifies no image was removed", async () => {
  const h = buildHarness([
    { json: PRODUCT_MEDIA }, // fetch media for classification
    {
      json: {
        data: {
          productDeleteMedia: {
            deletedMediaIds: ["gid://shopify/Video/2"],
            deletedProductImageIds: [], // no images touched
            mediaUserErrors: [],
            userErrors: [],
          },
        },
      },
    },
    // re-read after delete: video gone, image remains
    {
      json: {
        data: {
          product: {
            id: "p1",
            media: { nodes: [{ id: "gid://shopify/MediaImage/1", mediaContentType: "IMAGE" }] },
          },
        },
      },
    },
  ]);
  const res = await h.call("delete_product_video", {
    productId: "p1",
    mediaIds: ["gid://shopify/Video/2"],
  });
  assert.equal(res.isError, false, res.rawText);
  const data = res.data as { deleted: boolean; verified: boolean; deletedProductImageIds: string[] };
  assert.equal(data.deleted, true);
  assert.equal(data.verified, true);
  assert.deepEqual(data.deletedProductImageIds, []);
});

test("delete_product_video FAILS if Shopify reports an image was deleted (safety net)", async () => {
  const h = buildHarness([
    { json: PRODUCT_MEDIA },
    {
      json: {
        data: {
          productDeleteMedia: {
            deletedMediaIds: ["gid://shopify/Video/2"],
            deletedProductImageIds: ["gid://shopify/MediaImage/1"], // unexpected!
            mediaUserErrors: [],
            userErrors: [],
          },
        },
      },
    },
  ]);
  const res = await h.call("delete_product_video", { productId: "p1", mediaIds: ["gid://shopify/Video/2"] });
  assert.equal(res.isError, true);
  assert.match(res.rawText, /Safety violation/i);
});

test("delete_product_image REFUSES when a video id is included", async () => {
  const h = buildHarness([{ json: PRODUCT_MEDIA }]);
  const res = await h.call("delete_product_image", {
    productId: "p1",
    mediaIds: ["gid://shopify/MediaImage/1", "gid://shopify/Video/2"],
  });
  assert.equal(res.isError, true);
  assert.match(res.rawText, /not image media/i);
});

test("delete_media dispatcher with mediaType=video refuses image ids", async () => {
  const h = buildHarness([{ json: PRODUCT_MEDIA }]);
  const res = await h.call("delete_media", {
    productId: "p1",
    mediaType: "video",
    mediaIds: ["gid://shopify/MediaImage/1"],
  });
  assert.equal(res.isError, true);
  assert.match(res.rawText, /do not match/i);
});
