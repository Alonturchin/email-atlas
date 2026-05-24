import { describe, expect, it } from "vitest";
import { extractProductSlugs, prettifyProductSlug } from "./extract-products";

describe("extractProductSlugs", () => {
  it("pulls slugs from /products/<slug>", () => {
    expect(
      extractProductSlugs('<a href="https://eikona.com/products/face-shield">x</a>'),
    ).toEqual(["face-shield"]);
  });

  it("strips query strings and trailing slashes", () => {
    expect(
      extractProductSlugs(
        '<a href="https://eikona.com/products/face-shield?utm_source=klaviyo">x</a>',
      ),
    ).toEqual(["face-shield"]);
    expect(
      extractProductSlugs('<a href="/products/face-shield/">x</a>'),
    ).toEqual(["face-shield"]);
  });

  it("handles collections paths (slug at the end)", () => {
    expect(
      extractProductSlugs(
        '<a href="https://shop.eikona.com/collections/spring/products/widget">x</a>',
      ),
    ).toEqual(["widget"]);
  });

  it("handles /p/ shorthand", () => {
    expect(
      extractProductSlugs('<a href="https://example.com/p/abc-def">x</a>'),
    ).toEqual(["abc-def"]);
  });

  it("dedupes repeated mentions", () => {
    expect(
      extractProductSlugs(
        '<a href="/products/foo">a</a><a href="/products/foo/?x">b</a>',
      ),
    ).toEqual(["foo"]);
  });

  it("returns multiple slugs sorted", () => {
    expect(
      extractProductSlugs(
        '<a href="/products/zebra">z</a><a href="/products/alpha">a</a><a href="/products/mike">m</a>',
      ),
    ).toEqual(["alpha", "mike", "zebra"]);
  });

  it("rejects noise (all, sale, shop, etc.)", () => {
    expect(extractProductSlugs('<a href="/products/all">x</a>')).toEqual([]);
    expect(extractProductSlugs('<a href="/products/sale">x</a>')).toEqual([]);
    expect(
      extractProductSlugs('<a href="/collections/best-sellers/products/all">x</a>'),
    ).toEqual([]);
  });

  it("rejects numeric-only slugs (pagination/IDs)", () => {
    expect(extractProductSlugs('<a href="/products/123">x</a>')).toEqual([]);
  });

  it("rejects too-short slugs", () => {
    expect(extractProductSlugs('<a href="/products/a">x</a>')).toEqual([]);
  });

  it("returns empty for empty/null input", () => {
    expect(extractProductSlugs("")).toEqual([]);
    expect(extractProductSlugs(null)).toEqual([]);
    expect(extractProductSlugs(undefined)).toEqual([]);
  });

  it("ignores non-product paths", () => {
    expect(
      extractProductSlugs('<a href="https://eikona.com/about-us">x</a>'),
    ).toEqual([]);
    expect(
      extractProductSlugs('<a href="https://eikona.com/account">x</a>'),
    ).toEqual([]);
  });
});

describe("prettifyProductSlug", () => {
  it("title-cases hyphen-separated slugs", () => {
    expect(prettifyProductSlug("built-for-you-starter-kit")).toBe(
      "Built For You Starter Kit",
    );
    expect(prettifyProductSlug("face-shield")).toBe("Face Shield");
  });
  it("handles underscores too", () => {
    expect(prettifyProductSlug("skin_bundle")).toBe("Skin Bundle");
  });
});
