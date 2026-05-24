import { describe, expect, it } from "vitest";
import { deriveTagsFromName } from "./derive-tags";

describe("deriveTagsFromName — season", () => {
  it("matches season words anywhere in the name", () => {
    expect(deriveTagsFromName("Before Summer Starts - 25% off").season).toBe(
      "Summer",
    );
    expect(deriveTagsFromName("Spring Refresh").season).toBe("Spring");
    expect(deriveTagsFromName("Winter cleanup").season).toBe("Winter");
    expect(deriveTagsFromName("Fall lookbook").season).toBe("Fall");
    expect(deriveTagsFromName("Autumn arrivals").season).toBe("Fall");
  });
  it("returns null when no season word", () => {
    expect(deriveTagsFromName("Memorial Day BBQ").season).toBeNull();
    expect(deriveTagsFromName("Random campaign").season).toBeNull();
  });
});

describe("deriveTagsFromName — holiday", () => {
  it("matches common holidays", () => {
    expect(deriveTagsFromName("Memorial Day Early Bird").holiday).toBe(
      "Memorial Day",
    );
    expect(deriveTagsFromName("Happy Father's Day").holiday).toBe("Father's Day");
    expect(deriveTagsFromName("Mother's day brunch").holiday).toBe("Mother's Day");
    expect(deriveTagsFromName("Valentine's email").holiday).toBe("Valentine's Day");
    expect(deriveTagsFromName("St. Patrick's Day promo").holiday).toBe(
      "Patrick's Day",
    );
    expect(deriveTagsFromName("Halloween candy sale").holiday).toBe("Halloween");
    expect(deriveTagsFromName("Christmas eve").holiday).toBe("Christmas");
    expect(deriveTagsFromName("4th of July fireworks").holiday).toBe("4th of July");
    expect(deriveTagsFromName("Independence Day").holiday).toBe("4th of July");
  });
  it("distinguishes Black Friday vs Cyber Monday", () => {
    expect(deriveTagsFromName("BFCM 25% off").holiday).toBe("Black Friday");
    expect(deriveTagsFromName("Cyber Monday wrap").holiday).toBe("Cyber Monday");
  });
  it("returns null when no holiday word", () => {
    expect(deriveTagsFromName("Random campaign").holiday).toBeNull();
  });
});

describe("deriveTagsFromName — categories", () => {
  it("detects (Content) parens", () => {
    expect(
      deriveTagsFromName("Master the Memorial Day BBQ (Content)").categories,
    ).toContain("Content");
  });
  it("detects loyalty/rewards/points/prime", () => {
    expect(deriveTagsFromName("Loyalty perk Prime").categories).toContain(
      "Rewards/Points",
    );
    expect(deriveTagsFromName("Earn points").categories).toContain(
      "Rewards/Points",
    );
    expect(deriveTagsFromName("VIP early access").categories).toContain(
      "Rewards/Points",
    );
  });
  it("detects bundle/kit/routine", () => {
    expect(deriveTagsFromName("Built For You Starter Kit").categories).toContain(
      "Routine/Bundle",
    );
    expect(deriveTagsFromName("Daily routine guide").categories).toContain(
      "Routine/Bundle",
    );
    expect(deriveTagsFromName("Holiday Bundle 30% off").categories).toContain(
      "Routine/Bundle",
    );
  });
  it("detects subscriptions", () => {
    expect(deriveTagsFromName("Subscription savings").categories).toContain(
      "Subscriptions",
    );
    expect(deriveTagsFromName("Subscribe and save").categories).toContain(
      "Subscriptions",
    );
  });
  it("detects winback", () => {
    expect(deriveTagsFromName("Winback offer").categories).toContain("Winback");
    expect(deriveTagsFromName("We miss you").categories).toContain("Winback");
    expect(deriveTagsFromName("Lapsed members").categories).toContain("Winback");
  });
  it("can stack multiple categories", () => {
    const c = deriveTagsFromName(
      "Loyalty Prime Subscription routine bundle (Content)",
    ).categories;
    expect(c).toContain("Rewards/Points");
    expect(c).toContain("Subscriptions");
    expect(c).toContain("Routine/Bundle");
    expect(c).toContain("Content");
  });
  it("returns empty array when nothing matches", () => {
    expect(deriveTagsFromName("Random thing").categories).toEqual([]);
  });
});
