# RentOPC Shopify MCP — Tool Catalog

Total registered: **75** tools (39 write, 36 read).

All tools are genuinely implemented against the Shopify Admin GraphQL API 2026-07. Write tools support `dryRun`, verify results after mutation, and never report success unless Shopify confirms.

## collections

| Tool | Type | Description |
|---|---|---|
| `list_collections` | read | List collections (paginated). |
| `get_collection` | read | Get one collection by ID, including a page of its products. |
| `create_collection` | write | Create a manual collection. dryRun supported; verified after creation. |
| `update_collection` | write | Update a collection's title/description/handle. Read-before-write, dryRun, verified. |
| `delete_collection` | write | Delete a collection by ID. Requires explicit confirm:true. Read-before-write, dryRun, verified. |
| `add_products_to_collection` | write | Add products to a manual collection. dryRun supported; verified after write. |
| `remove_products_from_collection` | write | Remove products from a manual collection. dryRun supported. |

## diagnostics

| Tool | Type | Description |
|---|---|---|
| `get_auth_status` | read | Report authentication mode, whether credentials are configured, store, API version and token expiry. Never returns the secret or access token. |
| `verify_shopify_scopes` | read | Read back the access scopes granted to this app plus store/API version. Performs a live read-only Shopify query. Never returns credentials. |
| `get_shop` | read | Read basic shop information (name, domains, plan, currency). |
| `shopify_graphql_query` | read | Run an arbitrary READ-ONLY GraphQL query against the Admin API. Mutations are rejected; use the dedicated write tools instead. |
| `get_audit_log` | read | Return the recent local audit trail of tool invocations (redacted). Never contains credentials. |

## files

| Tool | Type | Description |
|---|---|---|
| `list_files` | read | List files in the Shopify Files library (paginated). |
| `get_file` | read | Get a single file by ID. |
| `upload_file` | write | Create a file in the Files library from a public source URL via fileCreate. dryRun supported; verifies the file exists afterward. |
| `delete_file` | write | Delete files from the Files library by ID via fileDelete. dryRun supported; verified. |

## inventory

| Tool | Type | Description |
|---|---|---|
| `list_inventory_items` | read | List inventory items with their levels per location. |
| `get_inventory_level` | read | Read the current available quantity for an inventory item at a location. Useful to obtain the value to pass as changeFromQuantity. |
| `set_inventory_quantity` | write | Set absolute available inventory for an item at a location using the 2026-07 inventorySetQuantities API. changeFromQuantity performs a compare-and-swap: pass the expected current quantity to guard against concurrent updates, or set enforceCompare:false to skip the check. Reads current level, supports dryRun, verifies the result. |

## media

| Tool | Type | Description |
|---|---|---|
| `get_product_media` | read | List all media for a product, classified by type (image, video, other), so you can pick exactly which media to act on. |
| `add_product_media` | write | Attach media (image/video/external video/3D) to a product from a source URL. dryRun supported; verifies the media exists on the product afterward. |
| `update_product_image_alt` | write | Update the alt text of a product IMAGE media. dryRun supported; verified after write. |
| `delete_product_video` | write | Delete ONLY video media (VIDEO / EXTERNAL_VIDEO) from a product. Refuses if any supplied media id is an image or unknown type, so product images are never removed accidentally. dryRun supported; verifies deletion. |
| `delete_media` | write | Type-aware media delete dispatcher. Requires an explicit mediaType ('video' or 'image') and only deletes media of that type after verifying every id matches. This is intentionally NOT a blanket 'delete all media' operation: it will never delete images when asked to delete videos, or vice versa. dryRun supported. |
| `delete_product_image` | write | Delete ONLY image media (IMAGE) from a product. Refuses if any supplied id is a video/other type. dryRun supported; verifies deletion. |

## metafields

| Tool | Type | Description |
|---|---|---|
| `get_metafields` | read | List metafields on any owner resource (product, collection, etc.) by owner ID. |
| `update_metafield` | write | Set (create or update) a metafield on an owner resource via metafieldsSet. dryRun supported; verifies the stored value after write. |
| `delete_metafield` | write | Delete a metafield by its metafield ID via metafieldsDelete. dryRun supported; verified. |

## metaobjects

| Tool | Type | Description |
|---|---|---|
| `list_metaobjects` | read | List metaobjects of a given type. |
| `get_metaobject` | read | Get one metaobject by ID. |
| `create_metaobject` | write | Create a metaobject of a given type via metaobjectCreate. dryRun supported; verified. |
| `update_metaobject` | write | Update a metaobject's fields/handle via metaobjectUpdate. Read-before-write, dryRun, verified. |
| `delete_metaobject` | write | Delete a metaobject by ID via metaobjectDelete. Requires confirm:true. dryRun, verified. |

## navigation

| Tool | Type | Description |
|---|---|---|
| `list_navigation` | read | List navigation menus. |
| `list_menus` | read | List navigation menus (alias of list_navigation). |
| `get_navigation` | read | Get one navigation menu by ID, including its items. |
| `create_navigation` | write | Create a navigation menu via menuCreate. dryRun supported; verified. |
| `update_navigation` | write | Update a navigation menu via menuUpdate. Read-before-write, dryRun, verified. |
| `delete_navigation` | write | Delete a navigation menu via menuDelete. Requires confirm:true. dryRun, verified. |

## pages

| Tool | Type | Description |
|---|---|---|
| `list_pages` | read | List online store pages (summary fields). |
| `list_pages_full` | read | List online store pages including full HTML body. |
| `get_page` | read | Get one page by ID, including full HTML body. |
| `create_page` | write | Create an online store page via pageCreate. dryRun supported; verified. |
| `update_page` | write | Update an online store page via pageUpdate. Read-before-write, dryRun, verified. |
| `delete_page` | write | Delete an online store page via pageDelete. Requires confirm:true. dryRun, verified. |

## products

| Tool | Type | Description |
|---|---|---|
| `list_products` | read | List products (paginated). |
| `get_product` | read | Get one product by ID. |
| `search_products` | read | Search products using a Shopify search query string. |
| `update_product` | write | Update product fields (title, description, type, vendor, tags, status). Reads current state, supports dryRun, verifies after write. |

## publishing

| Tool | Type | Description |
|---|---|---|
| `list_publications` | read | List sales-channel publications (e.g. Online Store, POS). |
| `get_publication_status` | read | Read the publication status of a product across channels. |
| `publish_product` | write | Publish a product to one or more publications (channels) via publishablePublish. dryRun supported; verifies published state after write. |
| `unpublish_product` | write | Unpublish a product from one or more publications via publishableUnpublish. dryRun supported; verified. |

## redirects

| Tool | Type | Description |
|---|---|---|
| `list_redirects` | read | List URL redirects (paginated). |
| `search_redirects` | read | Search URL redirects by query string (e.g. path or target). |
| `create_redirect` | write | Create a URL redirect. dryRun supported; verified after creation. |
| `update_redirect` | write | Update a URL redirect's path/target. Read-before-write, dryRun, verified. |
| `delete_redirect` | write | Delete a URL redirect by ID. dryRun supported; verified. |

## seo

| Tool | Type | Description |
|---|---|---|
| `get_product_seo` | read | Get the SEO title/description of a product. |
| `update_product_seo` | write | Update a product's SEO title and/or meta description. dryRun supported; verified after write. |

## themes

| Tool | Type | Description |
|---|---|---|
| `list_themes` | read | List all Shopify themes with their ID and Shopify-reported role (MAIN/UNPUBLISHED/DEMO/DEVELOPMENT). Does NOT assume which theme is live. |
| `get_theme` | read | Get one theme by explicit theme ID, including its Shopify role/status. |
| `get_theme_files` | read | List theme file metadata for an explicit theme ID (filenames, sizes, checksums). |
| `get_theme_assets` | read | List theme asset/file metadata for an explicit theme ID (alias of get_theme_files). |
| `read_theme_file` | read | Read the content of a single theme file from an explicit theme ID. |
| `write_theme_file` | write | Write a single theme file to an EXPLICIT theme ID via themeFilesUpsert. Reads the current file first, records a local content fingerprint (NOT a Shopify theme version), performs the upsert, then RE-READS the file from Shopify and verifies the new content matches. Requires write_themes + a Shopify exemption; access errors are surfaced honestly. dryRun supported. Never publishes or changes theme role. |
| `delete_theme_file` | write | Delete a single theme file from an EXPLICIT theme ID via themeFilesDelete. Requires confirm:true. Reads/snapshots the file first, then re-reads to verify it is gone. Requires write_themes + Shopify exemption. dryRun supported. |
| `update_theme_settings` | write | Update config/settings_data.json for an EXPLICIT theme ID. This is a thin, verified wrapper over write_theme_file targeting config/settings_data.json. dryRun supported; verified by re-read. Never publishes. |
| `create_theme` | write | Create a NEW theme from a source ZIP URL via themeCreate. New themes are always UNPUBLISHED (or DEVELOPMENT) — never live. Role is restricted to UNPUBLISHED/DEVELOPMENT; publishing is a separate, guarded step. Requires write_themes + Shopify exemption. dryRun supported; verified by re-read. |
| `duplicate_theme` | write | Duplicate an existing theme by creating a new UNPUBLISHED theme from a source ZIP. Shopify's Admin GraphQL API has no direct 'duplicate theme' mutation, so a source ZIP URL of the theme to copy MUST be provided (e.g. an export). Requires write_themes + Shopify exemption. dryRun supported; verified by re-read. Never publishes. |
| `publish_theme` | write | DISABLED BY DESIGN. Publishing a theme changes which theme is live and is never done automatically by this MCP. This tool always refuses unless explicitly forced with confirmPublish:true AND acknowledgeLiveChange:true, and even then requires an explicit theme ID. Use with extreme caution. |

## variants

| Tool | Type | Description |
|---|---|---|
| `list_variants` | read | List variants for a product. |
| `get_variant` | read | Get a single variant by ID. |
| `update_variant` | write | Update variant fields (price, compareAtPrice, barcode, taxable). Reads current state, supports dryRun, verifies after write. |
| `update_variant_price` | write | Update a variant's price (and optionally compareAtPrice). Reads current price, supports dryRun, verifies the new price after write. |

