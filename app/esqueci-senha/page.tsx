import Link from "next/link";
import { Logo } from "@/components/logo";
import { requestPasswordReset } from "@/app/login/actions";

export default async function EsqueciSenhaPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const params = await searchParams;
  return <main className="auth-page auth-curio-access"><section className="auth-brand"><Logo/><div><div className="eyebrow" style={{color:"#ffd454"}}>Recuperar acesso</div><h1>Esqueceu a senha? A gente te ajuda a voltar.</h1><p>O mesmo fluxo funciona para Admin, Professor e Família. Sua função no sistema não muda.</p></div><small>Um novo link, a mesma conta Curió.</small></section><section className="auth-form-side"><div className="auth-card auth-card-playful"><div className="eyebrow">Recuperação de senha</div><h2>Receber novo link</h2><p>Informe o e-mail usado no Curió.</p>{params.erro&&<div className="form-message form-error">{params.erro}</div>}{params.sucesso&&<div className="form-message form-success">Se houver uma conta com este e-mail, o link de recuperação será enviado.</div>}<form className="form-stack" action={requestPasswordReset}><div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="email" autoComplete="email" required/></div><button className="button button-primary button-block" type="submit">Enviar link de recuperação</button></form><Link className="button button-ghost button-block" href="/login">Voltar para entrar</Link></div></section></main>;
}
