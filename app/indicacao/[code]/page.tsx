import Link from "next/link";
import { Logo } from "@/components/logo";
import { createReferralEnrollmentRequest } from "@/app/indicacao/actions";
import { createClient } from "@/lib/supabase/server";

const grades = ["1º ano", "2º ano", "3º ano", "4º ano", "5º ano", "6º ano", "7º ano", "8º ano"];

export default async function ReferralLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lead?: string }>;
}) {
  const { code } = await params;
  const { lead } = await searchParams;
  const normalizedCode = decodeURIComponent(code).trim().toUpperCase();
  const supabase = await createClient();
  const { data: landing, error } = await supabase.rpc("referral_landing", {
    p_code: normalizedCode,
  });
  const referral = Array.isArray(landing) ? landing[0] : landing;

  if (error || !referral?.program_active) {
    return (
      <main className="referral-public-page">
        <div className="site-shell">
          <Logo />
          <section className="referral-public-card">
            <div className="eyebrow">Indicação CURIÓ</div>
            <h1>Este link não está disponível agora.</h1>
            <p className="muted">Você ainda pode conhecer o CURIÓ pelo site e conversar com a equipe normalmente.</p>
            <Link className="button button-primary" href="/#quero-conhecer">Conhecer o CURIÓ</Link>
          </section>
        </div>
      </main>
    );
  }

  const originText = referral.owner_type === "teacher"
    ? `Indicação de ${referral.owner_name || "um professor Curió"}`
    : "Indicação de uma família Curió";

  return (
    <main className="referral-public-page">
      <div className="site-shell">
        <Logo />
        <section className="referral-public-card">
          <div className="eyebrow">{originText}</div>
          <h1>Vamos entender como seu filho aprende.</h1>
          <p className="muted">
            Preencha seus dados para a equipe entrar em contato. O link registra a origem da indicação, mas não altera automaticamente preço, plano ou condições comerciais.
          </p>

          {lead === "sucesso" && <div className="form-message form-success">Recebemos seu interesse. A equipe do CURIÓ poderá entrar em contato pelos dados informados.</div>}
          {lead === "erro" && <div className="form-message form-error">Não foi possível enviar agora. Confira os campos e tente novamente ou fale com a equipe pelo site.</div>}

          <form action={createReferralEnrollmentRequest} className="form-stack">
            <input type="hidden" name="referral_code" value={normalizedCode} />
            <div className="form-row">
              <div className="field"><label>Nome do responsável *</label><input className="input" name="guardian_name" autoComplete="name" required /></div>
              <div className="field"><label>WhatsApp *</label><input className="input" name="phone_whatsapp" autoComplete="tel" required /></div>
            </div>
            <div className="field"><label>E-mail *</label><input className="input" type="email" name="email" autoComplete="email" required /></div>
            <div className="form-row">
              <div className="field"><label>Nome da criança</label><input className="input" name="child_name" /></div>
              <div className="field"><label>Idade</label><input className="input" type="number" name="child_age" min="5" max="18" /></div>
            </div>
            <div className="field">
              <label>Ano escolar *</label>
              <select className="select" name="grade_name" defaultValue="" required>
                <option value="" disabled>Selecione</option>
                {grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
              </select>
            </div>
            <div className="field"><label>O que mais preocupa ou precisa de apoio hoje?</label><textarea className="textarea" name="main_difficulties" placeholder="Conte um pouco sobre a rotina de estudos, matérias ou dificuldades." /></div>
            <label className="consent-line"><input type="checkbox" name="consent_contact" required /> Autorizo o CURIÓ a entrar em contato sobre esta solicitação.</label>
            <button className="button button-primary button-block" type="submit">Quero conhecer o CURIÓ</button>
          </form>

          <p className="text-small muted">{referral.public_rules || "A recompensa de quem indicou depende de matrícula, pagamento, permanência e regras de elegibilidade."}</p>
        </section>
      </div>
    </main>
  );
}
