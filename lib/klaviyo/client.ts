import "server-only";
import type { z } from "zod";

const BASE_URL = "https://a.klaviyo.com";
const REVISION = "2024-10-15";

export class KlaviyoError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message: string,
  ) {
    super(message);
    this.name = "KlaviyoError";
  }
}

export interface KlaviyoFetchOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | undefined>;
  body?: unknown;
  /** Max retries on 429. Default 5. */
  maxRetries?: number;
}

function getApiKey(): string {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key || key === "pk_REPLACE_ME") {
    throw new Error(
      "KLAVIYO_API_KEY is missing. Set it in .env.local before calling Klaviyo.",
    );
  }
  return key;
}

function buildUrl(path: string, query?: Record<string, string | undefined>) {
  // Allow absolute URLs (used to follow pagination `links.next`).
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }
  const url = new URL(path.replace(/^\//, ""), BASE_URL + "/");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rawFetch(
  path: string,
  options: KlaviyoFetchOptions = {},
): Promise<unknown> {
  const { method = "GET", query, body, maxRetries = 5 } = options;
  const url = buildUrl(path, query);

  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Klaviyo-API-Key ${getApiKey()}`,
        revision: REVISION,
        accept: "application/vnd.api+json",
        ...(body ? { "content-type": "application/vnd.api+json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 0;
      const backoff =
        retryAfter > 0
          ? retryAfter * 1000
          : Math.min(2 ** attempt * 500, 30_000);
      attempt += 1;
      await sleep(backoff);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new KlaviyoError(
        res.status,
        text,
        `Klaviyo ${method} ${path} failed: ${res.status} ${res.statusText}`,
      );
    }

    // 204 No Content guard
    if (res.status === 204) return null;
    return res.json();
  }
}

// Generic over the schema type itself (rather than its output) so TypeScript
// can always infer the return type from the passed schema. `z.ZodType<T>`
// inference is brittle with `.passthrough()` schemas — using `z.infer<S>`
// instead is the documented-working pattern.
export async function klaviyoGet<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  query?: Record<string, string | undefined>,
): Promise<z.infer<S>> {
  const json = await rawFetch(path, { method: "GET", query });
  return schema.parse(json);
}

export async function klaviyoPost<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  body: unknown,
): Promise<z.infer<S>> {
  const json = await rawFetch(path, { method: "POST", body });
  return schema.parse(json);
}
