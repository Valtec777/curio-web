import { NextResponse } from "next/server";
import { BRAND_LOGO_FALLBACK, BRAND_SETTING_KEY } from "@/lib/brand-assets";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let target = new URL(BRAND_LOGO_FALLBACK, request.url).toString();

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", BRAND_SETTING_KEY)
      .eq("is_public", true)
      .maybeSingle();

    const value = data?.value as Record<string, unknown> | null | undefined;
    const logo = typeof value?.logo === "string" ? value.logo.trim() : "";
    if (logo) target = logo;
  } catch {
    // A logo versionada do repositório continua sendo o fallback confiável.
  }

  return NextResponse.redirect(target, {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
