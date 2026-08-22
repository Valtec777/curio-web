import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { setFamilyPin } from "@/app/familia/access-actions";
import { updateFamilyNotifications } from "@/app/familia/actions";
import { updateStudentLearningSupport } from "@/app/familia/support-actions";
import { getFamilyPortal } from "@/lib/family";

export default async function FamilySettingsPage({ searchParams }: { searchParams: Promise<{ aluno?: string; erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { viewer, selectedChild, supabase } = await getFamilyPortal(query.aluno || null);
  const [{ data: profile }, { data: legal }, { data: support }] = await Promise.all([
    supabase.from("profiles").select("preferences").eq("id", viewer.user.id).maybeSingle(),
    supabase.from("legal_documents").select("title,public_slug,document_type,version,published_at").eq("status", "published").eq("is_current", true).order("document_type"),
    selectedChild
      ? supabase.from("student_support_preferences").select("reading_autonomy,guided_mode,audio_instructions").eq("student_id", selectedChild.student_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);
  const preferences = profile?.preferences && typeof profile.preferences === "object" ? profile.preferences as any : {};
  const notifications = preferences.notifications || {};
  const returnTo = selectedChild ? `/familia/configuracoes?aluno=${selectedChild.student_id}` : "/familia/configuracoes";
  const readingAutonomy = support?.reading_autonomy || "independent";

  return (
    <>
      <PageHeader eyebrow="Ninho da Família" title="Configurações" description="Segurança do espaço da criança, apoio à aprendizagem, notificações e documentos de privacidade." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="grid-2">
        <section className="panel family-highlight">
          <div className="panel-head"><div><h2>PIN de segurança</h2><p>O PIN protege a saída do espaço da criança e o retorno aos controles da família.</p></div></div>
          <form action={setFamilyPin} className="form-stack">
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="form-row">
              <div className="field"><label>Novo PIN</label><input className="input family-pin-input" name="pin" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" minLength={4} maxLength={4} required placeholder="••••" /></div>
              <div className="field"><label>Repita o PIN</label><input className="input family-pin-input" name="pinConfirmation" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" minLength={4} maxLength={4} required placeholder="••••" /></div>
            </div>
            <button className="button button-primary" type="submit">Alterar PIN</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>Notificações</h2><p>Escolha onde prefere receber avisos quando o canal estiver habilitado pelo PLUMARELI.</p></div></div>
          <form action={updateFamilyNotifications} className="form-stack">
            <input type="hidden" name="studentId" value={selectedChild?.student_id || ""} />
            <label className="preference-toggle"><span><strong>E-mail</strong><small>Aulas, prazos, documentos e avisos importantes.</small></span><input type="checkbox" name="email" defaultChecked={notifications.email !== false} /></label>
            <label className="preference-toggle"><span><strong>No aplicativo/site</strong><small>Avisos dentro do portal PLUMARELI.</small></span><input type="checkbox" name="app" defaultChecked={notifications.app !== false} /></label>
            <label className="preference-toggle"><span><strong>WhatsApp</strong><small>Preferência para avisos quando a integração estiver disponível.</small></span><input type="checkbox" name="whatsapp" defaultChecked={notifications.whatsapp === true} /></label>
            <button className="button button-primary" type="submit">Salvar notificações</button>
          </form>
        </section>
      </div>

      {selectedChild ? (
        <section className="panel family-highlight">
          <div className="panel-head">
            <div>
              <h2>Leitura e Modo Acompanhado</h2>
              <p>Conte como a criança lida com textos e navegação. O portal do aluno adapta a experiência e a equipe vinculada pode considerar esse apoio no acompanhamento.</p>
            </div>
            <Badge tone="purple">Apoio por aluno</Badge>
          </div>
          <form action={updateStudentLearningSupport} className="form-stack">
            <input type="hidden" name="studentId" value={selectedChild.student_id} />
            <div className="field">
              <label htmlFor="readingAutonomy">Autonomia de leitura</label>
              <select className="select" id="readingAutonomy" name="readingAutonomy" defaultValue={readingAutonomy}>
                <option value="independent">Lê com autonomia</option>
                <option value="developing">Está em processo de alfabetização / desenvolvendo autonomia</option>
                <option value="needs_support">Ainda precisa de ajuda para ler instruções</option>
              </select>
            </div>
            <label className="preference-toggle">
              <span><strong>Modo Acompanhado</strong><small>Indicado quando um responsável precisa ajudar a entrar, navegar ou ler. O adulto apoia o acesso; a criança continua pensando e respondendo.</small></span>
              <input type="checkbox" name="guidedMode" defaultChecked={support?.guided_mode === true} />
            </label>
            <label className="preference-toggle">
              <span><strong>Instruções em áudio</strong><small>Mostra no portal do aluno um botão para ouvir em português as orientações e enunciados preparados para leitura em voz alta.</small></span>
              <input type="checkbox" name="audioInstructions" defaultChecked={support?.audio_instructions === true} />
            </label>
            <div className="notice">O apoio do responsável serve para acesso e compreensão das instruções. As respostas, escolhas e tentativas continuam sendo do aluno.</div>
            <button className="button button-primary" type="submit">Salvar apoio de aprendizagem</button>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head"><div><h2>Privacidade e termos</h2><p>Somente documentos revisados e publicados pela administração aparecem como vigentes.</p></div></div>
        {legal?.length ? <div className="family-action-grid">{legal.map((doc: any) => <Link className="family-summary-card" href={`/legal/${doc.public_slug}`} key={doc.public_slug}><Badge tone="green">Versão {doc.version}</Badge><h3>{doc.title}</h3><p>{doc.document_type}</p><span>Ver documento →</span></Link>)}</div> : <div className="notice">Política de Privacidade, Termos de Uso e demais documentos estão em preparação/revisão no Admin. Eles serão exibidos aqui automaticamente depois da publicação.</div>}
      </section>
    </>
  );
}
