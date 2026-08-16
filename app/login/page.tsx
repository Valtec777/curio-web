import Link from "next/link";
import { login } from "./actions";
import { Logo } from "@/components/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="auth-page auth-curio-access">
      <section className="auth-brand">
        <Logo variant="wordmark" />
        <div>
          <div className="eyebrow" style={{ color: "#a8ee25" }}>Acesso PLUMARELI</div>
          <h1>Seu espaço começa com um convite do Plumareli.</h1>
          <p>
            As contas são liberadas pela administração após matrícula ou vínculo com a equipe.
            Não existe cadastro público de família, professor ou administrador.
          </p>
        </div>
        <small>Curiosidade move o mundo. Tecnologia ajuda. Seu cérebro resolve.</small>
      </section>

      <section className="auth-form-side">
        <div className="auth-card auth-card-playful">
          <div className="eyebrow">Bem-vindo de volta</div>
          <h2>Entrar no PLUMARELI</h2>
          <p>Use o e-mail liberado pela administração e a sua senha.</p>

          {params.erro && <div className="form-message form-error">{params.erro}</div>}
          {params.sucesso && <div className="form-message form-success">{params.sucesso}</div>}

          <form className="form-stack" action={login}>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input className="input" id="email" type="email" name="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input className="input" id="password" type="password" name="password" autoComplete="current-password" required />
            </div>
            <button className="button button-primary button-block" type="submit">Entrar</button>
          </form>

          <div className="auth-help-grid">
            <Link href="/primeiro-acesso"><strong>Primeiro acesso</strong><span>Receba o link para definir sua senha.</span></Link>
            <Link href="/esqueci-senha"><strong>Esqueci minha senha</strong><span>Receba um novo link de recuperação.</span></Link>
          </div>
          <p className="auth-admin-note">Ainda não recebeu acesso? Fale com a equipe Plumareli. A conta é criada somente pela administração.</p>
        </div>
      </section>
    </main>
  );
}
