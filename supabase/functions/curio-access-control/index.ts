import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizedOrigin(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!isLocal && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function localRedirectsAllowed() {
  return Deno.env.get("PLUMARELI_ALLOW_LOCAL_REDIRECTS") === "true" ||
    Deno.env.get("CURIO_ALLOW_LOCAL_REDIRECTS") === "true";
}

function configuredAppOrigin() {
  return normalizedOrigin(Deno.env.get("PLUMARELI_APP_ORIGIN"));
}

function legacyAppOrigin() {
  return normalizedOrigin(Deno.env.get("CURIO_APP_URL") || Deno.env.get("CURIO_APP_ORIGIN"));
}

function cleanOrigin(value: unknown) {
  const candidate = normalizedOrigin(value);
  const configured = configuredAppOrigin();

  if (candidate) {
    const url = new URL(candidate);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (isLocal) return localRedirectsAllowed() ? candidate : configured || legacyAppOrigin();

    // Apenas a configuração PLUMARELI é autoritativa. Variáveis CURIO antigas
    // continuam como fallback, mas nunca substituem uma origem HTTPS enviada pelo app.
    if (configured) return candidate === configured ? candidate : configured;
    return candidate;
  }

  return configured || legacyAppOrigin();
}

function emailErrorMessage(code?: string, message?: string) {
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return "Muitas tentativas de envio foram feitas em pouco tempo. Aguarde cerca de um minuto e tente novamente.";
  }
  return message || "Não foi possível enviar o link de acesso agora.";
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return reply(405, { error: "Método não permitido." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization");
    if (!authorization) return reply(401, { error: "Sessão obrigatória." });

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    const { data: callerData, error: callerError } = await caller.auth.getUser();
    if (callerError || !callerData.user) return reply(401, { error: "Sessão inválida." });

    const { data: adminRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return reply(403, { error: "Somente o Admin Plumareli pode gerenciar acessos." });

    const body = await req.json() as Record<string, unknown>;
    const action = cleanText(body.action);
    const authUserId = cleanText(body.auth_user_id);
    if (!authUserId) return reply(400, { error: "Usuário de acesso obrigatório." });

    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(authUserId);
    if (authUserError || !authUserData.user) return reply(404, { error: "Usuário de acesso não encontrado." });

    if (action === "send_access_link") {
      const email = cleanText(authUserData.user.email).toLowerCase();
      if (!email.includes("@")) return reply(400, { error: "Este usuário não possui um e-mail de acesso válido." });

      const origin = cleanOrigin(body.origin);
      if (!origin) {
        return reply(400, { error: "URL pública do Plumareli não configurada para envio de acesso." });
      }

      const { error: accessError } = await authClient.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${origin}/auth/confirm?next=/definir-senha`,
        },
      });

      if (accessError) {
        const message = emailErrorMessage(accessError.code, accessError.message);
        await admin.from("access_invitations").update({
          last_error: message,
          updated_at: new Date().toISOString(),
        }).eq("auth_user_id", authUserId).is("deleted_at", null);
        return reply(400, { error: message });
      }

      await admin.from("access_invitations").update({
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("auth_user_id", authUserId).is("deleted_at", null);

      return reply(200, { ok: true, email });
    }

    if (action === "update_contact") {
      const currentEmail = cleanText(authUserData.user.email).toLowerCase();
      const newEmail = cleanText(body.email).toLowerCase();
      const fullName = cleanText(body.full_name);
      const preferredName = cleanText(body.preferred_name);
      const phone = cleanText(body.phone_whatsapp);

      if (!fullName) return reply(400, { error: "Informe o nome completo." });
      if (newEmail && !newEmail.includes("@")) return reply(400, { error: "Informe um e-mail válido." });

      if (newEmail && newEmail !== currentEmail) {
        const { error: emailUpdateError } = await admin.auth.admin.updateUserById(authUserId, {
          email: newEmail,
          user_metadata: {
            ...(authUserData.user.user_metadata || {}),
            full_name: fullName,
            preferred_name: preferredName || null,
            phone_whatsapp: phone || null,
          },
        });
        if (emailUpdateError) {
          return reply(400, { error: emailUpdateError.message || "Não foi possível atualizar o e-mail de acesso." });
        }
      } else {
        const { error: metadataError } = await admin.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            ...(authUserData.user.user_metadata || {}),
            full_name: fullName,
            preferred_name: preferredName || null,
            phone_whatsapp: phone || null,
          },
        });
        if (metadataError) return reply(400, { error: "Não foi possível atualizar os dados de autenticação." });
      }

      const effectiveEmail = newEmail || currentEmail;
      const now = new Date().toISOString();
      const { error: profileError } = await admin.from("profiles").upsert({
        id: authUserId,
        full_name: fullName,
        preferred_name: preferredName || fullName,
        phone_whatsapp: phone || null,
        updated_at: now,
      });
      if (profileError) return reply(500, { error: "O login foi atualizado, mas o perfil não pôde ser sincronizado." });

      await admin.from("teachers").update({ phone_whatsapp: phone || null }).eq("profile_id", authUserId);

      const invitationUpdate: Record<string, unknown> = {
        full_name: fullName,
        preferred_name: preferredName || null,
        phone_whatsapp: phone || null,
        last_error: null,
        updated_at: now,
      };
      if (effectiveEmail) invitationUpdate.email = effectiveEmail;

      const { error: invitationError } = await admin.from("access_invitations")
        .update(invitationUpdate)
        .eq("auth_user_id", authUserId)
        .is("deleted_at", null);
      if (invitationError) return reply(500, { error: "Os dados principais foram atualizados, mas o histórico de acesso não pôde ser sincronizado." });

      return reply(200, { ok: true, email: effectiveEmail, phone_whatsapp: phone || null });
    }

    return reply(400, { error: "Ação inválida." });
  } catch (error) {
    return reply(500, { error: error instanceof Error ? error.message : "Erro interno." });
  }
});
