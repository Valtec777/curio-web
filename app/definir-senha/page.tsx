"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";

export default function DefinirSenhaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Validando seu link de acesso...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function prepareSession() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("Sessão de recuperação ausente.");

        if (active) {
          setReady(true);
          setMessage("Link confirmado. Agora escolha uma senha só sua.");
          window.history.replaceState({}, "", "/definir-senha");
        }
      } catch {
        if (active) {
          setError("Este link é inválido ou expirou. Solicite um novo link de primeiro acesso ou recuperação.");
          setMessage("");
        }
      }
    }
    prepareSession();
    return () => { active = false; };
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirmPassword) return setError("As senhas não coincidem.");

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError("Não foi possível salvar a senha. Solicite um novo link e tente novamente.");
      return;
    }

    await supabase.rpc("mark_access_invitation_accepted");
    await supabase.auth.signOut();
    window.location.href = `/login?sucesso=${encodeURIComponent("Senha definida com sucesso. Agora você já pode entrar no Curió.")}`;
  }

  return (
    <main className="auth-page auth-curio-access">
      <section className="auth-brand">
        <Logo />
        <div>
          <div className="eyebrow" style={{ color: "#ff4aa2" }}>Senha do CURIÓ</div>
          <h1>Crie uma senha só sua.</h1>
          <p>O link confirma a sua conta sem expor senha para a equipe Curió.</p>
        </div>
        <small>Depois disso, é só entrar normalmente.</small>
      </section>
      <section className="auth-form-side">
        <div className="auth-card auth-card-playful">
          <div className="eyebrow">Definir senha</div>
          <h2>Escolha sua nova senha</h2>
          {message && <div className="form-message form-success">{message}</div>}
          {error && <div className="form-message form-error">{error}</div>}
          {ready ? (
            <form className="form-stack" onSubmit={submit}>
              <div className="field"><label htmlFor="password">Nova senha</label><input className="input" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
              <div className="field"><label htmlFor="confirmPassword">Confirmar nova senha</label><input className="input" id="confirmPassword" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></div>
              <button className="button button-primary button-block" type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar minha senha"}</button>
            </form>
          ) : !error ? <div className="auth-loading-orb" aria-label="Validando acesso">✦</div> : <a className="button button-secondary button-block" href="/primeiro-acesso">Solicitar novo link</a>}
        </div>
      </section>
    </main>
  );
}
