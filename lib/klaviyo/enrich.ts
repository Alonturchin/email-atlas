export type Season = "spring" | "summer" | "fall" | "winter";

export function deriveSeason(date: Date): Season {
  const m = date.getUTCMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

const MS_PER_DAY = 86_400_000;
const WINDOW_DAYS = 3;

function utc(y: number, monthIdx: number, day: number): Date {
  return new Date(Date.UTC(y, monthIdx, day));
}

// Nth occurrence (1..5) of weekday (0=Sun..6=Sat) in month.
function nthWeekday(
  y: number,
  monthIdx: number,
  weekday: number,
  nth: number,
): Date {
  const first = new Date(Date.UTC(y, monthIdx, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(y, monthIdx, 1 + offset + (nth - 1) * 7));
}

// Last occurrence of weekday in month.
function lastWeekday(y: number, monthIdx: number, weekday: number): Date {
  const lastDay = new Date(Date.UTC(y, monthIdx + 1, 0));
  const offset = (lastDay.getUTCDay() - weekday + 7) % 7;
  return new Date(lastDay.getTime() - offset * MS_PER_DAY);
}

interface HolidayDef {
  name: string;
  dateFor: (year: number) => Date;
}

const HOLIDAYS: HolidayDef[] = [
  { name: "New Year's", dateFor: (y) => utc(y, 0, 1) },
  { name: "Valentine's Day", dateFor: (y) => utc(y, 1, 14) },
  { name: "Mother's Day", dateFor: (y) => nthWeekday(y, 4, 0, 2) }, // 2nd Sun May
  { name: "Memorial Day", dateFor: (y) => lastWeekday(y, 4, 1) }, // last Mon May
  { name: "Father's Day", dateFor: (y) => nthWeekday(y, 5, 0, 3) }, // 3rd Sun Jun
  { name: "4th of July", dateFor: (y) => utc(y, 6, 4) },
  { name: "Labor Day", dateFor: (y) => nthWeekday(y, 8, 1, 1) }, // 1st Mon Sep
  { name: "Halloween", dateFor: (y) => utc(y, 9, 31) },
  { name: "Thanksgiving", dateFor: (y) => nthWeekday(y, 10, 4, 4) }, // 4th Thu Nov
  {
    name: "Black Friday",
    dateFor: (y) => new Date(nthWeekday(y, 10, 4, 4).getTime() + MS_PER_DAY),
  },
  {
    name: "Cyber Monday",
    dateFor: (y) =>
      new Date(nthWeekday(y, 10, 4, 4).getTime() + 4 * MS_PER_DAY),
  },
  { name: "Christmas", dateFor: (y) => utc(y, 11, 25) },
];

export function deriveHoliday(date: Date): string | null {
  // Normalize to UTC midnight so day-diffs are whole integers regardless of the
  // input's time-of-day. Otherwise Math.round(±0.5) creates sign-biased ties.
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const y = day.getUTCFullYear();
  let best: { name: string; diff: number } | null = null;
  // Cover late-Dec → next-year and early-Jan → previous-year wraps.
  for (const dy of [y - 1, y, y + 1]) {
    for (const h of HOLIDAYS) {
      const diff = Math.abs(
        (day.getTime() - h.dateFor(dy).getTime()) / MS_PER_DAY,
      );
      if (diff <= WINDOW_DAYS && (best === null || diff < best.diff)) {
        best = { name: h.name, diff };
      }
    }
  }
  return best?.name ?? null;
}
