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
  return normalizedOrigin(
    Deno.env.get("PLUMARELI_APP_ORIGIN") ||
      Deno.env.get("CURIO_APP_URL") ||
      Deno.env.get("CURIO_APP_ORIGIN"),
  );
}

function cleanOrigin(value: unknown) {
  const candidate = normalizedOrigin(value);
  const configured = configuredAppOrigin();

  if (candidate) {
    const url = new URL(candidate);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (isLocal) return localRedirectsAllowed() ? candidate : configured;
    if (configured) return candidate === configured ? candidate : configured;
    return candidate;
  }

  return configured;
}

function emailErrorMessage(code?: string, message?: string) {
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return "Muitas tentativas de envio foram feitas em pouco tempo. Aguarde cerca de um minuto e tente novamente.";
  }
  return message || "Não foi possível enviar o e-mail de acesso agora.";
}

async function sendAccessLink(
  authClient: ReturnType<typeof createClient>,
  email: string,
  origin: string,
) {
  return authClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=/definir-senha`,
    },
  });
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return { user: null, error };
    const user = data.users.find((item) => (item.email || "").toLowerCase() === email);
    if (user) return { user, error: null };
    if (data.users.length < 100) break;
  }
  return { user: null, error: null };
}

async function prepareAccessUser(
  admin: ReturnType<typeof createClient>,
  input: {
    email: string;
    fullName: string;
    preferredName: string | null;
    phone: string | null;
    role: string;
  },
) {
  const found = await findAuthUserByEmail(admin, input.email);
  if (found.error) {
    return { authUserId: null, error: found.error.message || "Não foi possível consultar o usuário de acesso." };
  }

  let authUserId = found.user?.id || null;
  if (!authUserId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: input.email,
      user_metadata: {
        full_name: input.fullName,
        preferred_name: input.preferredName,
        phone_whatsapp: input.phone,
      },
    });
    if (createError || !created.user) {
      return { authUserId: null, error: createError?.message || "Não foi possível criar o usuário de acesso." };
    }
    authUserId = created.user.id;
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: authUserId,
    full_name: input.fullName,
    preferred_name: input.preferredName || input.fullName,
    phone_whatsapp: input.phone,
    updated_at: new Date().toISOString(),
  });
  if (profileError) return { authUserId, error: "Não foi possível preparar o perfil de acesso." };

  const { error: roleError } = await admin.from("user_roles").upsert(
    { user_id: authUserId, role: input.role },
    { onConflict: "user_id,role" },
  );
  if (roleError) return { authUserId, error: "Não foi possível vincular o papel do usuário." };

  if (input.role === "guardian") {
    const { error: guardianError } = await admin.from("guardians").upsert(
      { profile_id: authUserId },
      { onConflict: "profile_id" },
    );
    if (guardianError) return { authUserId, error: "Não foi possível preparar o perfil da família." };
  } else if (input.role === "teacher") {
    const { error: teacherError } = await admin.from("teachers").upsert(
      { profile_id: authUserId, phone_whatsapp: input.phone, active: true },
      { onConflict: "profile_id" },
    );
    if (teacherError) return { authUserId, error: "Não foi possível preparar o perfil do professor." };
  }

  return { authUserId, error: null };
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function invitationIdempotencyKey(body: Record<string, unknown>, callerUserId: string) {
  const explicit = cleanText(body.idempotency_key);
  const student = (body.student && typeof body.student === "object") ? body.student as Record<string, unknown> : {};
  const canonical = explicit || JSON.stringify({
    caller_user_id: callerUserId,
    role: cleanText(body.role || "guardian"),
    email: cleanText(body.email).toLowerCase(),
    full_name: cleanText(body.full_name).toLowerCase(),
    relationship: cleanText(body.relationship).toLowerCase(),
    student_id: cleanText(body.student_id),
    student_full_name: cleanText(student.full_name).toLowerCase(),
    student_grade_id: cleanText(student.grade_id),
    student_school_name: cleanText(student.school_name).toLowerCase(),
  });
  return `invite-v1:${await sha256Hex(`${callerUserId}:${canonical}`)}`;
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

    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) return reply(401, { error: "Sessão inválida." });

    const { data: adminRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return reply(403, { error: "Somente o Admin Plumareli pode gerenciar acessos." });

    const body = await req.json() as Record<string, unknown>;
    const action = cleanText(body.action || "invite");

    if (action === "update_email") {
      const invitationId = cleanText(body.invitation_id);
      const newEmail = cleanText(body.email).toLowerCase();
      if (!invitationId || !newEmail.includes("@")) return reply(400, { error: "Informe a matrícula e um e-mail válido." });

      const { data: invitation, error: invitationError } = await admin
        .from("access_invitations")
        .select("id,email,auth_user_id,role,deleted_at")
        .eq("id", invitationId)
        .eq("role", "guardian")
        .is("deleted_at", null)
        .maybeSingle();
      if (invitationError || !invitation) return reply(404, { error: "Matrícula não encontrada." });
      if (!invitation.auth_user_id) return reply(409, { error: "O acesso ainda não possui usuário para editar o e-mail." });
      if (String(invitation.email || "").toLowerCase() === newEmail) return reply(200, { ok: true, unchanged: true });

      const oldEmail = String(invitation.email || "").toLowerCase();
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(invitation.auth_user_id, { email: newEmail });
      if (authUpdateError) return reply(400, { error: authUpdateError.message || "Não foi possível atualizar o e-mail de acesso." });

      const { error: invitationUpdateError } = await admin
        .from("access_invitations")
        .update({ email: newEmail, updated_at: new Date().toISOString(), last_error: null })
        .eq("auth_user_id", invitation.auth_user_id)
        .is("deleted_at", null);

      if (invitationUpdateError) {
        if (oldEmail) await admin.auth.admin.updateUserById(invitation.auth_user_id, { email: oldEmail });
        return reply(500, { error: "O e-mail de login foi alterado, mas a matrícula não pôde ser sincronizada. A alteração foi revertida." });
      }

      return reply(200, { ok: true, email: newEmail });
    }

    if (action === "resend") {
      const invitationId = cleanText(body.invitation_id);
      const origin = cleanOrigin(body.origin);
      if (!invitationId) return reply(400, { error: "Convite obrigatório." });
      if (!origin) return reply(400, { error: "URL pública do Plumareli não configurada para envio de acesso." });
      const { data: invitation, error } = await admin
        .from("access_invitations")
        .select("*")
        .eq("id", invitationId)
        .is("deleted_at", null)
        .single();
      if (error || !invitation) return reply(404, { error: "Convite não encontrado." });

      const prepared = await prepareAccessUser(admin, {
        email: String(invitation.email || "").toLowerCase(),
        fullName: cleanText(invitation.full_name) || "Usuário Plumareli",
        preferredName: cleanText(invitation.preferred_name) || null,
        phone: cleanText(invitation.phone_whatsapp) || null,
        role: cleanText(invitation.role || "guardian"),
      });
      if (prepared.error || !prepared.authUserId) {
        const message = prepared.error || "Não foi possível preparar o usuário de acesso.";
        await admin.from("access_invitations").update({ status: "error", last_error: message, updated_at: new Date().toISOString() }).eq("id", invitation.id);
        return reply(400, { error: message });
      }

      if (invitation.role === "guardian" && invitation.student_id) {
        const { data: guardian } = await admin.from("guardians").select("id").eq("profile_id", prepared.authUserId).maybeSingle();
        if (guardian) {
          await admin.from("guardian_students").upsert({
            guardian_id: guardian.id,
            student_id: invitation.student_id,
            relationship: invitation.relationship || "Responsável",
            can_view_progress: true,
            can_manage_access: true,
          }, { onConflict: "guardian_id,student_id" });
        }
      }

      const { error: accessError } = await sendAccessLink(authClient, invitation.email, origin);
      if (accessError) {
        const message = emailErrorMessage(accessError.code, accessError.message);
        await admin.from("access_invitations").update({ status: "error", auth_user_id: prepared.authUserId, last_error: message, updated_at: new Date().toISOString() }).eq("id", invitation.id);
        return reply(400, { error: message });
      }
      await admin.from("access_invitations").update({ auth_user_id: prepared.authUserId, status: "sent", sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("id", invitation.id);
      return reply(200, { ok: true, invitation_id: invitation.id, student_id: invitation.student_id || null });
    }

    if (action !== "invite") return reply(400, { error: "Ação inválida." });

    const email = cleanText(body.email).toLowerCase();
    const fullName = cleanText(body.full_name);
    const preferredName = cleanText(body.preferred_name) || null;
    const phone = cleanText(body.phone_whatsapp) || null;
    const role = cleanText(body.role || "guardian");
    const origin = cleanOrigin(body.origin);
    const allowedRoles = ["guardian", "teacher", "admin"];
    if (!email.includes("@") || !fullName || !allowedRoles.includes(role)) {
      return reply(400, { error: "Preencha nome, e-mail e papel corretamente." });
    }
    if (!origin) return reply(400, { error: "URL pública do Plumareli não configurada para envio de acesso." });

    const requestDay = new Date().toISOString().slice(0, 10);
    const idempotencyKey = await invitationIdempotencyKey(body, userData.user.id);
    let studentId = body.student_id ? cleanText(body.student_id) : null;
    let invitation: Record<string, any> | null = null;
    let reused = false;

    const invitationPayload = {
      email,
      role,
      full_name: fullName,
      preferred_name: preferredName,
      phone_whatsapp: phone,
      student_id: studentId,
      relationship: body.relationship || null,
      invited_by_user_id: userData.user.id,
      status: "pending",
      idempotency_key: idempotencyKey,
      request_day: requestDay,
      deleted_at: null,
      deleted_by_user_id: null,
      delete_reason: null,
    };

    const { data: insertedInvitation, error: invitationError } = await admin
      .from("access_invitations")
      .insert(invitationPayload)
      .select("id,status,student_id,auth_user_id,updated_at")
      .single();

    if (invitationError?.code === "23505") {
      reused = true;
      const { data: existing, error: existingError } = await admin
        .from("access_invitations")
        .select("id,status,student_id,auth_user_id,updated_at")
        .eq("idempotency_key", idempotencyKey)
        .eq("request_day", requestDay)
        .is("deleted_at", null)
        .maybeSingle();
      if (existingError || !existing) return reply(409, { error: "A matrícula já foi enviada, mas não foi possível recuperar o registro existente." });
      invitation = existing;
      studentId = existing.student_id || studentId;

      if (["sent", "accepted"].includes(existing.status)) {
        return reply(200, { ok: true, reused: true, invitation_id: existing.id, student_id: existing.student_id || null });
      }

      const updatedAt = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
      if (existing.status === "pending" && updatedAt && Date.now() - updatedAt < 30_000) {
        return reply(200, { ok: true, reused: true, processing: true, invitation_id: existing.id, student_id: existing.student_id || null });
      }

      await admin.from("access_invitations").update({
        email,
        full_name: fullName,
        preferred_name: preferredName,
        phone_whatsapp: phone,
        relationship: body.relationship || null,
        status: "pending",
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else if (invitationError || !insertedInvitation) {
      return reply(400, { error: invitationError?.message || "Não foi possível iniciar a matrícula." });
    } else {
      invitation = insertedInvitation;
    }

    if (!invitation) return reply(500, { error: "Não foi possível reservar a matrícula." });

    if (role === "guardian" && !studentId && body.student && typeof body.student === "object") {
      const student = body.student as Record<string, unknown>;
      if (cleanText(student.full_name)) {
        const { data: createdStudent, error: studentError } = await admin
          .from("students")
          .insert({
            full_name: cleanText(student.full_name),
            preferred_name: cleanText(student.preferred_name || student.full_name),
            grade_id: student.grade_id || null,
            school_name: student.school_name || null,
            status: cleanText(student.status || "active"),
            deleted_at: null,
            deleted_by_user_id: null,
            delete_reason: null,
          })
          .select("id")
          .single();
        if (studentError || !createdStudent) {
          await admin.from("access_invitations").update({ status: "error", last_error: studentError?.message || "Falha ao criar aluno", updated_at: new Date().toISOString() }).eq("id", invitation.id);
          return reply(400, { error: `Não foi possível criar o aluno: ${studentError?.message || "erro desconhecido"}` });
        }
        studentId = createdStudent.id;
        const { error: attachStudentError } = await admin.from("access_invitations").update({ student_id: studentId, updated_at: new Date().toISOString() }).eq("id", invitation.id);
        if (attachStudentError) {
          await admin.from("students").delete().eq("id", studentId);
          await admin.from("access_invitations").update({ status: "error", last_error: attachStudentError.message, updated_at: new Date().toISOString() }).eq("id", invitation.id);
          return reply(400, { error: "Não foi possível vincular o aluno à matrícula." });
        }
      }
    }

    const prepared = await prepareAccessUser(admin, { email, fullName, preferredName, phone, role });
    if (prepared.error || !prepared.authUserId) {
      const message = prepared.error || "Não foi possível preparar o usuário de acesso.";
      await admin.from("access_invitations").update({ status: "error", last_error: message, updated_at: new Date().toISOString() }).eq("id", invitation.id);
      return reply(400, { error: message });
    }
    const authUserId = prepared.authUserId;

    if (role === "guardian" && studentId) {
      const { data: guardian, error: guardianLookupError } = await admin.from("guardians").select("id").eq("profile_id", authUserId).maybeSingle();
      if (guardianLookupError || !guardian) {
        await admin.from("access_invitations").update({ status: "error", auth_user_id: authUserId, last_error: guardianLookupError?.message || "Perfil de responsável ausente", updated_at: new Date().toISOString() }).eq("id", invitation.id);
        return reply(400, { error: "Não foi possível localizar o perfil do responsável após criar o acesso." });
      }
      const { error: guardianStudentError } = await admin.from("guardian_students").upsert({
        guardian_id: guardian.id,
        student_id: studentId,
        relationship: body.relationship || "Responsável",
        can_view_progress: true,
        can_manage_access: true,
      }, { onConflict: "guardian_id,student_id" });
      if (guardianStudentError) {
        await admin.from("access_invitations").update({ status: "error", auth_user_id: authUserId, last_error: guardianStudentError.message, updated_at: new Date().toISOString() }).eq("id", invitation.id);
        return reply(400, { error: "O acesso foi criado, mas o vínculo responsável-aluno falhou." });
      }
    }

    const { error: accessError } = await sendAccessLink(authClient, email, origin);
    if (accessError) {
      const message = emailErrorMessage(accessError.code, accessError.message);
      await admin.from("access_invitations").update({ status: "error", auth_user_id: authUserId, last_error: message, updated_at: new Date().toISOString() }).eq("id", invitation.id);
      return reply(400, { error: message });
    }

    const { error: finalizeError } = await admin.from("access_invitations").update({
      auth_user_id: authUserId,
      student_id: studentId,
      status: "sent",
      sent_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", invitation.id);
    if (finalizeError) return reply(500, { error: "O acesso foi criado, mas a matrícula não pôde ser finalizada." });

    return reply(200, { ok: true, reused, invitation_id: invitation.id, student_id: studentId });
  } catch (error) {
    return reply(500, { error: error instanceof Error ? error.message : "Erro interno." });
  }
});