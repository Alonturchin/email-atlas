/**
 * Pull product slugs from a Klaviyo email's HTML by looking for canonical
 * product URLs: `/products/<slug>` (Shopify, WooCommerce variants) or
 * `/p/<slug>` (BigCommerce-style). Returns unique slugs, sorted.
 *
 * This is intentionally a string-regex pass over the raw HTML — parsing
 * Klaviyo's stitched-together <table> markup with a DOM parser is overkill
 * for a one-pattern extractor.
 */

const PRODUCT_URL_RE =
  /\/(?:products?|p)\/([a-z0-9][a-z0-9_-]{1,80}?)(?=[/?#"'\s<>]|$)/gi;

// Slugs that appear at the right URL position but aren't real products —
// usually collection / index landings that share the path shape.
const NOISE_SLUGS = new Set([
  "all",
  "view-all",
  "all-products",
  "best-sellers",
  "bestsellers",
  "new",
  "new-arrivals",
  "sale",
  "shop",
  "shop-all",
  "index",
  "default",
  "category",
  "collections",
  "featured",
]);

export function extractProductSlugs(
  html: string | null | undefined,
): string[] {
  if (!html) return [];
  const set = new Set<string>();
  // Re-anchor each call since the regex is global.
  PRODUCT_URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PRODUCT_URL_RE.exec(html))) {
    const slug = m[1].toLowerCase();
    if (slug.length < 2) continue;
    if (NOISE_SLUGS.has(slug)) continue;
    // Numeric-only slugs are usually pagination or IDs, not product handles.
    if (/^\d+$/.test(slug)) continue;
    set.add(slug);
  }
  return Array.from(set).sort();
}

/** Display helper — turn `built-for-you-starter-kit` → `Built For You Starter Kit`. */
export function prettifyProductSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
