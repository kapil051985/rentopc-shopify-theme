/**
 * Self-test: boots the MCP server with a fake auth provider (NO network, NO
 * live Shopify calls) and verifies that all expected tools are registered.
 *
 * Exits non-zero on any mismatch so CI / operators get a hard signal.
 */
import { createServer } from "./createServer.js";
import type { TokenProvider, AuthStatus } from "./auth.js";

/** The full target catalog of 73 tool names plus 2 bonus diagnostics tools. */
const EXPECTED_CATALOG = [
  // diagnostics (+2 bonus: get_shop already in original list, get_audit_log & get_inventory_level are bonus)
  "get_auth_status", "verify_shopify_scopes", "shopify_graphql_query", "get_shop", "get_audit_log",
  // products / seo
  "list_products", "get_product", "search_products", "update_product", "get_product_seo", "update_product_seo",
  // variants
  "list_variants", "get_variant", "update_variant", "update_variant_price",
  // inventory (+1 bonus get_inventory_level)
  "list_inventory_items", "get_inventory_level", "set_inventory_quantity",
  // media
  "get_product_media", "add_product_media", "update_product_image_alt",
  "delete_media", "delete_product_video", "delete_product_image",
  // collections
  "list_collections", "get_collection", "create_collection", "update_collection",
  "delete_collection", "add_products_to_collection", "remove_products_from_collection",
  // metafields
  "get_metafields", "update_metafield", "delete_metafield",
  // files
  "list_files", "get_file", "upload_file", "delete_file",
  // pages
  "list_pages", "list_pages_full", "get_page", "create_page", "update_page", "delete_page",
  // redirects
  "list_redirects", "search_redirects", "create_redirect", "update_redirect", "delete_redirect",
  // navigation
  "list_navigation", "list_menus", "get_navigation", "create_navigation", "update_navigation", "delete_navigation",
  // metaobjects
  "list_metaobjects", "get_metaobject", "create_metaobject", "update_metaobject", "delete_metaobject",
  // publishing
  "list_publications", "get_publication_status", "publish_product", "unpublish_product",
  // themes
  "list_themes", "get_theme", "get_theme_files", "get_theme_assets", "read_theme_file",
  "write_theme_file", "delete_theme_file", "update_theme_settings", "create_theme",
  "duplicate_theme", "publish_theme",
];

/** The 73 original target names (subset of EXPECTED_CATALOG minus 2 bonus). */
const ORIGINAL_TARGET = EXPECTED_CATALOG.filter(
  (n) => n !== "get_audit_log" && n !== "get_inventory_level"
);

class FakeProvider implements TokenProvider {
  readonly mode = "client_credentials" as const;
  readonly canRefresh = true;
  async getToken(): Promise<string> {
    return "fake-token-not-used-in-selftest";
  }
  invalidate(): void {}
  status(): AuthStatus {
    return {
      mode: "client_credentials",
      credentialsConfigured: true,
      canRefresh: true,
      hasToken: false,
      expiresAt: null,
      expiresInSeconds: null,
    };
  }
}

function main(): void {
  const { server, toolContext } = createServer({
    provider: new FakeProvider(),
    skipStoreEnvCheck: true,
  });

  // Names actually registered on the MCP server.
  const registeredOnServer = Object.keys(
    (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools
  ).sort();
  const registryNames = toolContext.registered.map((t) => t.name).sort();

  const expected = [...EXPECTED_CATALOG].sort();
  const missing = expected.filter((n) => !registeredOnServer.includes(n));
  const unexpected = registeredOnServer.filter((n) => !expected.includes(n));

  const originalMissing = ORIGINAL_TARGET.filter((n) => !registeredOnServer.includes(n));

  const writeCount = toolContext.registered.filter((t) => t.write).length;
  const readCount = toolContext.registered.length - writeCount;

  const ok =
    missing.length === 0 &&
    unexpected.length === 0 &&
    registryNames.length === registeredOnServer.length &&
    originalMissing.length === 0;

  const report = {
    ok,
    liveShopifyCalls: false,
    totalToolsRegistered: registeredOnServer.length,
    originalTargetCount: ORIGINAL_TARGET.length,
    originalTargetImplemented: ORIGINAL_TARGET.length - originalMissing.length,
    bonusTools: ["get_audit_log", "get_inventory_level"],
    writeTools: writeCount,
    readTools: readCount,
    missing,
    unexpected,
    originalMissing,
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!ok) process.exit(1);
}

main();
