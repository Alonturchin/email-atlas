# Build: Email Creative Intelligence Platform (Klaviyo)

I want to build a web app that connects email *design* to email *results* — like Upspring.ai does for ads (https://app.upspring.ai), but for Klaviyo email campaigns. The core insight: marketers should be able to browse past campaigns visually (like a Pinterest of emails) and instantly see which designs drove results.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui** for components
- **Prisma** + **SQLite** for local dev (Postgres in production)
- **Klaviyo API** (server-side only — never expose the private key)
- **TanStack Query** for client-side data fetching
- **Lucide** icons
- Fonts: **Fraunces** (display) + **Inter** (body) via `next/font/google`

## Project structure

```
email-intel/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                 # Main gallery view
│   │   ├── campaigns/[id]/page.tsx  # Campaign detail
│   │   └── compare/page.tsx         # Side-by-side compare
│   ├── api/
│   │   ├── campaigns/route.ts       # GET campaigns w/ filters
│   │   ├── campaigns/[id]/route.ts  # GET single campaign
│   │   └── sync/route.ts            # POST trigger Klaviyo sync
│   └── layout.tsx
├── lib/
│   ├── klaviyo/
│   │   ├── client.ts                # Klaviyo API wrapper
│   │   ├── sync.ts                  # Sync job (campaigns + metrics + templates)
│   │   └── enrich.ts                # Derive holiday/season from send_date
│   ├── db.ts                        # Prisma client
│   └── utils.ts
├── components/
│   ├── campaign-card.tsx
│   ├── campaign-grid.tsx
│   ├── filter-sidebar.tsx
│   ├── search-bar.tsx
│   ├── template-preview.tsx         # Renders Klaviyo HTML in sandboxed iframe
│   ├── metrics-overlay.tsx
│   ├── compare-bar.tsx
│   └── ui/                           # shadcn components
├── prisma/
│   └── schema.prisma
└── .env.local
```

## Database schema (Prisma)

```prisma
model Campaign {
  id              String   @id              // Klaviyo campaign ID
  name            String
  subject         String
  previewText     String?
  sendDate        DateTime
  status          String                    // sent, draft, scheduled
  templateHtml    String?  @db.Text         // full HTML from Klaviyo template
  thumbnailUrl    String?                   // optional rendered thumbnail
  tags            String   // JSON array of Klaviyo tag names
  holiday         String?                   // derived: "Father's Day", etc.
  season          String?                   // derived: spring/summer/fall/winter
  audienceNames   String   // JSON array
  // Metrics (flattened for fast filtering/sorting)
  recipients      Int      @default(0)
  openRate        Float    @default(0)
  clickRate       Float    @default(0)
  ctor            Float    @default(0)      // click-to-open
  conversionRate  Float    @default(0)
  revenue         Float    @default(0)
  aov             Float    @default(0)
  unsubscribeRate Float    @default(0)
  lastSyncedAt    DateTime @default(now())
  favorited       Boolean  @default(false)
  @@index([sendDate])
  @@index([holiday])
  @@index([season])
}
```

## Klaviyo integration — what to actually call

The Klaviyo API splits this across endpoints. Build a sync function that:

1. **List campaigns**: `GET /api/campaigns/?filter=equals(messages.channel,'email')&include=campaign-messages,tags` — gets campaigns + their tag list + linked message IDs.
2. **Get message content per campaign**: `GET /api/campaign-messages/{id}/` — subject, preview text, template_id.
3. **Get template HTML**: `GET /api/templates/{id}/` — for the visual preview.
4. **Get campaign report (the metrics)**: `POST /api/campaign-values-reports/` with body:
   ```json
   {
     "data": {
       "type": "campaign-values-report",
       "attributes": {
         "statistics": ["recipients", "open_rate", "click_rate", "click_to_open_rate", "conversion_rate", "conversion_value", "unsubscribe_rate", "average_order_value"],
         "timeframe": { "key": "last_365_days" },
         "conversion_metric_id": "<placed_order_metric_id>"
       }
     }
   }
   ```
   First fetch the "Placed Order" metric ID via `GET /api/metrics/?filter=equals(name,'Placed Order')`.

API base: `https://a.klaviyo.com/api/`. Required headers:
```
Authorization: Klaviyo-API-Key {API_KEY}
revision: 2024-10-15
accept: application/vnd.api+json
```

Add Klaviyo key to `.env.local` as `KLAVIYO_API_KEY=pk_...`. Read it only on the server.

## Holiday + season enrichment

Build a `lib/klaviyo/enrich.ts` with two functions:

- `deriveSeason(date)` → spring (Mar–May), summer (Jun–Aug), fall (Sep–Nov), winter (Dec–Feb).
- `deriveHoliday(date)` → matches send date against a holiday window (±3 days). Cover: New Year's, Valentine's Day, Mother's Day (2nd Sunday of May), Memorial Day (last Monday of May), Father's Day (3rd Sunday of June), 4th of July, Labor Day, Halloween, Thanksgiving, Black Friday, Cyber Monday, Christmas. Return `null` if no match.

Run enrichment during sync so it's stored on the row, not computed per-request.

## UI requirements

**Visual direction**: clean, editorial, white-dominant like Upspring — but with a touch more character. Cream background (`#faf8f3`), Fraunces italic for headlines, mono labels for metadata. Generous whitespace. The email previews themselves provide the color.

**Main page (`/`)**: 
- Sticky top bar: logo + search input (full-width, debounced) + favorites toggle.
- Left sidebar (sticky, collapsible): Filters — Holidays (toggleable pills), Seasons (4 pills), Tags (multi-select, derived from all campaigns' tags + sorted by frequency), Date range picker, Min open rate slider.
- Main grid: responsive 3–5 column grid of `<CampaignCard>` components. Each card shows: template preview (rendered HTML in sandboxed iframe with `pointer-events: none` and scaled to fit), date + holiday badge, campaign name (Fraunces italic), subject line, and a 3-stat row at the bottom (Open / Click / Revenue).
- Top toolbar above grid: result count, sort dropdown (date, revenue, open rate, click rate), grid density toggle.

**Template preview component**: Render the Klaviyo HTML inside `<iframe srcDoc={html} sandbox="" style="pointer-events:none; transform: scale(0.4); transform-origin: top left; width: 250%; height: 250%">`. This safely renders the email at a thumbnail size without letting any embedded scripts run.

**Campaign detail (`/campaigns/[id]`)**: split layout — left side full-size template iframe, right side metrics in big numbers, subject/preview, tags, and "similar campaigns" suggestions (same holiday OR overlapping tags).

**Compare (`/compare?ids=a,b`)**: side-by-side, two columns, with winners highlighted per-metric.

## Implementation order

1. Scaffold Next.js + Tailwind + shadcn + Prisma. Initialize DB.
2. Build the Klaviyo client (`lib/klaviyo/client.ts`) — a typed fetch wrapper with the auth header baked in. Add retry on 429 (Klaviyo rate limits).
3. Build the sync route (`POST /api/sync`) — fetches campaigns → messages → templates → metrics, runs enrichment, upserts into DB. Make it idempotent. Log progress.
4. Build the campaigns API (`GET /api/campaigns`) — accepts query params: `q`, `tags[]`, `holiday`, `season`, `from`, `to`, `minOpenRate`, `sort`, `favoritesOnly`. Returns paginated results.
5. Build the gallery page with filter sidebar + search wired to the API via TanStack Query.
6. Build the card + template preview iframe.
7. Build the detail page.
8. Build the compare page.
9. Add a favorite toggle (PATCH `/api/campaigns/[id]`).

## Important guardrails

- **Never call Klaviyo from the browser.** All Klaviyo calls happen in `/api/*` routes or server components only.
- **Cache aggressively.** Campaign metrics rarely change after a campaign sends — sync nightly, not on every request.
- **Sandbox the iframes.** `sandbox=""` with no permissions, no `allow-scripts`. Klaviyo HTML can contain tracking pixels — that's fine to load but never executable JS.
- **Type the Klaviyo responses.** They're nested JSON:API format — write Zod schemas in `lib/klaviyo/types.ts` and parse responses.
- **Handle missing data gracefully.** Some campaigns won't have template HTML (SMS, drafts, very old) — show a placeholder.

## What to build first

Start with steps 1–4 (scaffold + Klaviyo client + sync + campaigns API) and pause for me to add my Klaviyo API key and run a first sync. Then we'll iterate on the UI together.

When you're ready, ask me for my Klaviyo API key and whether I want SQLite or Postgres for local dev.