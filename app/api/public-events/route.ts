import { z } from "zod";

const eventSchema = z.object({
  name: z.enum(["landing_view", "lead_cta_click", "lead_form_submit", "lead_success", "login_click"]),
  path: z.string().trim().min(1).max(160).refine((value) => value === "/" || value.startsWith("/convite/")),
  placement: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).strict();

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (!contentType.includes("application/json")) {
    return new Response(null, { status: 415, headers: { "cache-control": "no-store" } });
  }
  if (Number.isFinite(contentLength) && contentLength > 1024) {
    return new Response(null, { status: 413, headers: { "cache-control": "no-store" } });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) {
    return new Response(null, { status: 400, headers: { "cache-control": "no-store" } });
  }

  console.log(JSON.stringify({
    level: "info",
    msg: "public_analytics",
    event: parsed.data.name,
    path: parsed.data.path,
    placement: parsed.data.placement ?? null,
    privacy: "no_pii",
  }));

  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
