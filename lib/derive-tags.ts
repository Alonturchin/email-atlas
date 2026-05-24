/**
 * Derive season / holiday / categories from a campaign's NAME (not its date).
 * Rule of thumb: don't tag unless the keyword actually appears in the title.
 * That way "Summer" only includes campaigns the user marketed as summer
 * campaigns, not every send between June and August.
 */

export type Season = "Summer" | "Spring" | "Winter" | "Fall";

export const SEASONS: Season[] = ["Summer", "Spring", "Winter", "Fall"];

const SEASON_PATTERNS: { name: Season; rx: RegExp }[] = [
  { name: "Summer", rx: /\bsummer\b/i },
  { name: "Spring", rx: /\bspring\b/i },
  { name: "Winter", rx: /\bwinter\b/i },
  { name: "Fall", rx: /\b(fall|autumn)\b/i },
];

// Order matters when two windows overlap (e.g. Black Friday vs Cyber Monday).
// We pick the FIRST match in this list, so put more-specific terms first.
const HOLIDAY_PATTERNS: { name: string; rx: RegExp }[] = [
  { name: "Cyber Monday", rx: /\bcyber[\s-]*monday\b|\bcm\b/i },
  { name: "Black Friday", rx: /\bblack[\s-]*friday\b|\bbfcm\b|\bbf\b/i },
  { name: "Thanksgiving", rx: /\bthanksgiving\b/i },
  { name: "Christmas", rx: /\bchristmas\b|\bxmas\b/i },
  { name: "Boxing Day", rx: /\bboxing[\s-]*day\b/i },
  { name: "Hanukkah", rx: /\bhanukkah\b|\bchanukah\b/i },
  { name: "New Year's", rx: /\bnew[\s-]*year'?s?\b|\bnye\b/i },
  { name: "Valentine's Day", rx: /\bvalentine'?s?\b|\bv[\s-]*day\b/i },
  { name: "Patrick's Day", rx: /\bpatrick'?s?\b|\bst[\s.]*patty\b|\bstpatricks?\b/i },
  { name: "Easter", rx: /\beaster\b/i },
  { name: "President's Day", rx: /\bpresident'?s?[\s-]*day\b/i },
  { name: "Mother's Day", rx: /\bmother'?s?[\s-]*day\b|\bmom'?s?[\s-]*day\b/i },
  { name: "Memorial Day", rx: /\bmemorial[\s-]*day\b/i },
  { name: "Father's Day", rx: /\bfather'?s?[\s-]*day\b|\bdad'?s?[\s-]*day\b/i },
  { name: "4th of July", rx: /\b(4th[\s-]*of[\s-]*july|independence[\s-]*day|july[\s-]*4|fourth[\s-]*of[\s-]*july)\b/i },
  { name: "Labor Day", rx: /\blabor[\s-]*day\b|\blabour[\s-]*day\b/i },
  { name: "Halloween", rx: /\bhalloween\b/i },
];

export const HOLIDAYS = HOLIDAY_PATTERNS.map((h) => h.name);

export type Category =
  | "Content"
  | "Rewards/Points"
  | "Routine/Bundle"
  | "Subscriptions"
  | "Winback";

export const CATEGORIES: Category[] = [
  "Content",
  "Rewards/Points",
  "Routine/Bundle",
  "Subscriptions",
  "Winback",
];

const CATEGORY_PATTERNS: { name: Category; rx: RegExp }[] = [
  {
    name: "Content",
    rx: /\(content\)|\bcontent\b|\barticle\b|\bguide\b|\bhow[\s-]*to\b|\btips?\b|\beducation/i,
  },
  {
    name: "Rewards/Points",
    rx: /\brewards?\b|\bpoints?\b|\bloyalty\b|\bprime\b|\btier(s)?\b|\bvip\b/i,
  },
  {
    name: "Routine/Bundle",
    rx: /\broutine\b|\bbundle\b|\bkit\b|\bstarter[\s-]+(kit|set|pack)\b|\bregimen\b/i,
  },
  {
    name: "Subscriptions",
    rx: /\bsubscriptions?\b|\bsubscribe\b|\bauto[\s-]*ship\b/i,
  },
  {
    name: "Winback",
    rx: /\bwinback\b|\bwin[\s-]+back\b|\bcome[\s-]+back\b|\bmiss(ed)?[\s-]+you\b|\blapsed?\b|\bre[\s-]*engage(ment)?\b/i,
  },
];

export interface DerivedTags {
  season: Season | null;
  holiday: string | null;
  categories: Category[];
}

export function deriveTagsFromName(name: string | null | undefined): DerivedTags {
  if (!name) return { season: null, holiday: null, categories: [] };

  let season: Season | null = null;
  for (const s of SEASON_PATTERNS) {
    if (s.rx.test(name)) {
      season = s.name;
      break;
    }
  }

  let holiday: string | null = null;
  for (const h of HOLIDAY_PATTERNS) {
    if (h.rx.test(name)) {
      holiday = h.name;
      break;
    }
  }

  const categories: Category[] = [];
  for (const c of CATEGORY_PATTERNS) {
    if (c.rx.test(name)) categories.push(c.name);
  }

  return { season, holiday, categories };
}
