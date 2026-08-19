import Link from "next/link";
import { Logo } from "@/components/logo";
import { createEnrollmentRequest } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function ReferralLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lead?: string }>;
}) {
  const { code: rawCode } = await params;
  const { lead } = await searchParams;
  const code = String(rawCode || "").trim().toUpperCase();
  const supabase = await createClient();
  const [{ data: landingRows }, { data: grades }] = await Promise.all([
    supabase.rpc("referral_landing", { p_code: code }),
    supabase.from("grades").select("id,name,sort_order").eq("active", true).order("sort_order"),
  ]);
  const landing: any = landingRows?.[0] || null;

  if (!landing?.program_active) {
    return <main className="site-shell section"><div className="flex space-between align-center wrap" style={{ marginBottom: 38 }}><Logo /><Link className="button button-secondary" href="/">Voltar ao início</Link></div><section className="panel" style={{ maxWidth: 720, margin: "70px auto" }}><div className="eyebrow">Convite PLUMARELI</div><h1>Este convite não está disponível agora.</h1><p className="muted">A campanha pode ter sido encerrada ou pausada. Você ainda pode conhecer o PLUMARELI pela página principal.</p><Link className="button button-primary mt-16" href="/">Conhecer o PLUMARELI</Link></section></main>;
  }

  const inviter = landing.owner_type === "teacher" ? `Você recebeu um convite de ${landing.owner_name}.` : "Uma família PLUMARELI convidou você para conhecer a plataforma.";

  return <>
    <header className="public-header"><div className="site-shell public-header-inner"><Logo /><Link className="button button-secondary" href="/">Conhecer o site</Link></div></header>
    <main>
      <section className="section curio-public-hero">
        <div className="site-shell lead-grid">
          <div className="lead-copy" style={{ minWidth: 0 }}>
            <div className="eyebrow eyebrow-green">Convite PLUMARELI</div>
            <h1 style={{ fontSize: "clamp(42px, 6vw, 70px)", lineHeight: 1, margin: "12px 0 18px", maxWidth: 680 }}>Aprender pode ficar mais leve quando existe acompanhamento.</h1>
            <p>{inviter}</p>
            <p>Conte um pouco sobre a rotina escolar. A equipe entra em contato para explicar como funciona e orientar o próximo passo.</p>
          </div>

          <form className="lead-form" style={{ marginTop: "clamp(34px, 4.5vw, 58px)" }} action={createEnrollmentRequest} id="quero-conhecer">
            <input type="hidden" name="referral_code" value={code} />
            {lead === "sucesso" && <div className="form-message form-success">Recebemos seu interesse. A equipe PLUMARELI entrará em contato com você.</div>}
            {lead === "erro" && <div className="form-message form-error">Não foi possível enviar agora. Confira os campos e tente novamente.</div>}
            <div className="form-row">
              <div className="field"><label>Nome do responsável *</label><input className="input" name="guardian_name" required placeholder="Seu nome" /></div>
              <div className="field"><label>WhatsApp *</label><input className="input" name="phone_whatsapp" required placeholder="(71) 9 ....-...." /></div>
            </div>
            <div className="field"><label>E-mail *</label><input className="input" type="email" name="email" required placeholder="voce@exemplo.com" /></div>
            <div className="form-row">
              <div className="field"><label>Nome da criança</label><input className="input" name="child_name" placeholder="Nome da criança" /></div>
              <div className="field"><label>Idade da criança</label><input className="input" type="number" name="child_age" min="5" max="18" /></div>
            </div>
            <div className="field"><label>Ano escolar *</label><select className="select" name="grade_name" required defaultValue=""><option value="" disabled>Selecione</option>{(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.name}>{grade.name}</option>)}</select></div>
            <fieldset className="subject-fieldset"><legend>Matérias que precisam de acompanhamento</legend><div className="subject-checks">{["Língua Portuguesa", "Matemática", "Ciências", "História", "Geografia", "Inglês", "Outras"].map((subject) => <label key={subject}><input type="checkbox" name="subjects" value={subject} /> {subject}</label>)}</div></fieldset>
            <div className="field"><label>Principais dificuldades</label><textarea className="textarea" name="main_difficulties" placeholder="Conte o que mais preocupa hoje" /></div>
            <div className="field"><label>Mensagem <span className="field-optional">opcional</span></label><textarea className="textarea" name="message" placeholder="Algo que queira compartilhar" /></div>
            <label className="consent-line"><input type="checkbox" name="consent_contact" required /> Autorizo o contato do PLUMARELI sobre esta solicitação.</label>
            <button className="button button-primary button-block" type="submit">Quero conhecer o PLUMARELI</button>
          </form>
        </div>
      </section>
    </main>
  </>;
}
