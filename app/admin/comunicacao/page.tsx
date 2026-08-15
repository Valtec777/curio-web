import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAnnouncement, setAnnouncementActive } from "./actions";

function dt(value?: string | null) {
  if (!value) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

const audienceLabel: Record<string, string> = {
  all: "Todos os perfis",
  public: "Site público",
  guardians: "Famílias",
  teachers: "Professores",
  students: "Alunos",
  admins: "Administração",
};

export default async function AdminCommunicationPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id,title,body,audience,active,starts_at,ends_at,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader
        eyebrow="Admin • Operação"
        title="Comunicação"
        description="Crie avisos para o portal PLUMARELI e para o site. E-mail e WhatsApp ficam identificados como integrações separadas para não parecer que foram enviados quando ainda não foram."
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Novo comunicado</h2>
            <p>Escolha quem deve ver e, se quiser, programe o período de exibição.</p>
          </div>
        </div>
        <form action={createAnnouncement} className="form-stack">
          <div className="form-row">
            <div className="field"><label>Título *</label><input className="input" name="title" required maxLength={180} /></div>
            <div className="field">
              <label>Público *</label>
              <select className="select" name="audience" defaultValue="guardians" required>
                <option value="guardians">Famílias</option>
                <option value="teachers">Professores</option>
                <option value="students">Alunos</option>
                <option value="all">Todos os perfis logados</option>
                <option value="public">Site público</option>
                <option value="admins">Administração</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Mensagem *</label><textarea className="textarea" name="body" required maxLength={5000} placeholder="Escreva o comunicado em linguagem simples e direta." /></div>
          <div className="form-row">
            <div className="field"><label>Começar em <span className="field-optional">opcional</span></label><input className="input" type="datetime-local" name="startsAt" /></div>
            <div className="field"><label>Encerrar em <span className="field-optional">opcional</span></label><input className="input" type="datetime-local" name="endsAt" /></div>
          </div>
          <label className="consent-line"><input type="checkbox" name="active" defaultChecked /> Deixar visível no PLUMARELI quando chegar a data</label>
          <button className="button button-primary" type="submit">Salvar comunicado</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Canais</h2><p>O estado abaixo é propositalmente explícito para evitar falso envio.</p></div></div>
        <div className="grid-3">
          <article className="mission-card"><Badge tone="green">Funcionando</Badge><h3>Portal PLUMARELI</h3><p>O aviso é exibido aos perfis autorizados conforme público e período.</p></article>
          <article className="mission-card"><Badge tone="green">Funcionando</Badge><h3>Site</h3><p>Comunicados marcados para o público do site podem ser lidos sem login.</p></article>
          <article className="mission-card"><Badge tone="yellow">Integração pendente</Badge><h3>E-mail e WhatsApp</h3><p>O texto pode ser preparado aqui, mas nenhum envio externo será declarado até existir um provedor configurado e testado.</p></article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Comunicados cadastrados</h2><p>Pause e reative sem apagar o histórico.</p></div></div>
        {announcements?.length ? (
          <div className="form-stack">
            {announcements.map((item: any) => (
              <article className="mission-card" key={item.id}>
                <div className="flex space-between gap-8 wrap">
                  <div>
                    <div className="flex gap-8 wrap">
                      <Badge tone={item.active ? "green" : "neutral"}>{item.active ? "Ativo" : "Pausado"}</Badge>
                      <Badge tone="blue">{audienceLabel[item.audience] || item.audience}</Badge>
                    </div>
                    <h3>{item.title}</h3>
                  </div>
                  <form action={setAnnouncementActive}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="active" value={item.active ? "false" : "true"} />
                    <button className="button button-secondary button-small" type="submit">{item.active ? "Pausar" : "Reativar"}</button>
                  </form>
                </div>
                <p>{item.body}</p>
                <small className="muted">Início: {dt(item.starts_at)} • Fim: {dt(item.ends_at)}</small>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Nenhum comunicado criado" description="Os avisos salvos pelo Admin aparecerão aqui." />}
      </section>
    </>
  );
}
