import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const supabase = await createClient();

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";

  if (ok) {
    redirectTo.pathname = next;
    return NextResponse.redirect(redirectTo);
  }

  // Links padrão do Supabase podem trazer a sessão no fragmento (#access_token...).
  // O servidor não recebe fragmentos; esta pequena ponte roda no navegador e os
  // encaminha para a tela de definição de senha, onde a sessão é validada.
  if (!tokenHash && !code) {
    const destination = next === "/dashboard" ? "/definir-senha" : next;
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PLUMARELI</title></head><body><script>window.location.replace(${JSON.stringify(destination)} + window.location.hash);</script></body></html>`;
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("erro", "Este link é inválido ou expirou. Solicite um novo link de acesso.");
  return NextResponse.redirect(redirectTo);
}
