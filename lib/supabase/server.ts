import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const PUBLIC_CONTENT_CACHE_SECONDS = 300;
const PUBLIC_CONTENT_TAG = "public-landing-data";
const PUBLIC_CONTENT_TABLES = new Set(["plans", "legal_documents", "characters"]);

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function publicContentTable(input: RequestInfo | URL) {
  try {
    const url = new URL(requestUrl(input));
    const match = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    const table = match?.[1] || "";
    return PUBLIC_CONTENT_TABLES.has(table) ? table : null;
  } catch {
    return null;
  }
}

export async function createClient() {
  const cookieStore = await cookies();
  const hasAuthenticatedSession = cookieStore
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));

  const cachedPublicFetch: typeof fetch = (input, init) => {
    const table = publicContentTable(input);
    const canCache = !hasAuthenticatedSession && requestMethod(input, init) === "GET" && Boolean(table);

    if (!canCache) return fetch(input, init);

    const nextInit = init as NextFetchInit | undefined;
    return fetch(input, {
      ...init,
      cache: "force-cache",
      next: {
        ...nextInit?.next,
        revalidate: PUBLIC_CONTENT_CACHE_SECONDS,
        tags: [PUBLIC_CONTENT_TAG, `public-landing-${table}`],
      },
    } as NextFetchInit);
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        fetch: cachedPublicFetch,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, _headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components não podem gravar cookies.
            // O proxy atualiza a sessão antes da renderização.
          }
        },
      },
    }
  );
}
