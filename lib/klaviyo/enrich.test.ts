import { describe, expect, it } from "vitest";
import { deriveHoliday, deriveSeason } from "./enrich";

const d = (iso: string) => new Date(iso + "T12:00:00Z");

describe("deriveSeason", () => {
  it("classifies months into seasons", () => {
    expect(deriveSeason(d("2026-03-01"))).toBe("spring");
    expect(deriveSeason(d("2026-05-31"))).toBe("spring");
    expect(deriveSeason(d("2026-06-01"))).toBe("summer");
    expect(deriveSeason(d("2026-08-31"))).toBe("summer");
    expect(deriveSeason(d("2026-09-15"))).toBe("fall");
    expect(deriveSeason(d("2026-11-30"))).toBe("fall");
    expect(deriveSeason(d("2026-12-25"))).toBe("winter");
    expect(deriveSeason(d("2026-01-15"))).toBe("winter");
    expect(deriveSeason(d("2026-02-28"))).toBe("winter");
  });
});

describe("deriveHoliday — fixed dates", () => {
  it("matches exact dates", () => {
    expect(deriveHoliday(d("2026-01-01"))).toBe("New Year's");
    expect(deriveHoliday(d("2026-02-14"))).toBe("Valentine's Day");
    expect(deriveHoliday(d("2026-07-04"))).toBe("4th of July");
    expect(deriveHoliday(d("2026-10-31"))).toBe("Halloween");
    expect(deriveHoliday(d("2026-12-25"))).toBe("Christmas");
  });
});

describe("deriveHoliday — floating dates for 2026", () => {
  it("Mother's Day = 2nd Sunday of May = May 10, 2026", () => {
    expect(deriveHoliday(d("2026-05-10"))).toBe("Mother's Day");
  });

  it("Memorial Day = last Monday of May = May 25, 2026", () => {
    expect(deriveHoliday(d("2026-05-25"))).toBe("Memorial Day");
  });

  it("Father's Day = 3rd Sunday of June = Jun 21, 2026", () => {
    expect(deriveHoliday(d("2026-06-21"))).toBe("Father's Day");
  });

  it("Labor Day = 1st Monday of September = Sep 7, 2026", () => {
    expect(deriveHoliday(d("2026-09-07"))).toBe("Labor Day");
  });

  it("Thanksgiving = 4th Thursday of November = Nov 26, 2026", () => {
    expect(deriveHoliday(d("2026-11-26"))).toBe("Thanksgiving");
  });

  it("Black Friday = day after Thanksgiving = Nov 27, 2026", () => {
    expect(deriveHoliday(d("2026-11-27"))).toBe("Black Friday");
  });

  it("Cyber Monday = Monday after Thanksgiving = Nov 30, 2026", () => {
    expect(deriveHoliday(d("2026-11-30"))).toBe("Cyber Monday");
  });
});

describe("deriveHoliday — ±3 day window", () => {
  it("matches within window", () => {
    expect(deriveHoliday(d("2026-12-22"))).toBe("Christmas");
    expect(deriveHoliday(d("2026-12-28"))).toBe("Christmas");
    expect(deriveHoliday(d("2026-07-01"))).toBe("4th of July");
    expect(deriveHoliday(d("2026-07-07"))).toBe("4th of July");
  });

  it("returns null outside any window", () => {
    expect(deriveHoliday(d("2026-03-15"))).toBeNull();
    expect(deriveHoliday(d("2026-08-15"))).toBeNull();
  });
});

describe("deriveHoliday — year boundaries", () => {
  it("late December near New Year's wraps to next year", () => {
    expect(deriveHoliday(d("2025-12-30"))).toBe("New Year's");
    expect(deriveHoliday(d("2025-12-29"))).toBe("New Year's");
  });

  it("early January near New Year's", () => {
    expect(deriveHoliday(d("2026-01-03"))).toBe("New Year's");
  });
});

describe("deriveHoliday — overlapping windows pick closest", () => {
  it("Black Friday vs Cyber Monday in 2026 (BF=Nov 27, CM=Nov 30)", () => {
    expect(deriveHoliday(d("2026-11-28"))).toBe("Black Friday");
    expect(deriveHoliday(d("2026-11-29"))).toBe("Cyber Monday");
  });
});
