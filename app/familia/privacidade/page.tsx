import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recordFamilyLegalDecision } from "./actions";

const generalDecisionSlugs = ["termos-de-uso", "politica-de-privacidade"] as const;
const childDecisionSlugs = ["consentimento-dados-pessoais", "autorizacao-imagem-voz-producoes"] as const;
const informationalSlugs = [
  "privacidade-da-crianca",
  "pagamento-cobranca",
  "cancelamento-faltas-reagendamentos",
] as const;

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function decisionLabel(decision?: string | null) {
  if (decision === "accepted") return "Aceito";
  if (decision === "declined") return "Não autorizado";
  if (decision === "revoked") return "Autorização revogada";
  return "Sem decisão registrada";
}

function decisionTone(decision?: string | null): "green" | "yellow" | "pink" | "neutral" {
  if (decision === "accepted") return "green";
  if (decision === "declined" || decision === "revoked") return "pink";
  return "yellow";
}

export default async function FamilyPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const viewer = await requireRole("guardian");
  const supabase = await createClient();

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id,active")
    .eq("profile_id", viewer.user.id)
    .maybeSingle();

  if (!guardian?.active) {
    return <EmptyState title="Privacidade indisponível" description="A administração precisa concluir o vínculo da família." />;
  }

  const [{ data: links }, { data: documents }, { data: events }] = await Promise.all([
    supabase
      .from("guardian_students")
      .select("student_id,students(id,preferred_name,full_name,deleted_at)")
      .eq("guardian_id", guardian.id),
    supabase
      .from("legal_documents")
      .select("id,title,public_slug,document_type,version,published_at,body,file_path")
      .eq("status", "published")
      .eq("is_current", true)
      .order("document_type"),
    supabase
      .from("legal_acceptance_events")
      .select("id,legal_document_id,student_id,decision,document_version,occurred_at")
      .eq("user_id", viewer.user.id)
      .order("occurred_at", { ascending: false })
      .limit(200),
  ]);

  const children = (links ?? [])
    .filter((link: any) => !link.students?.deleted_at)
    .map((link: any) => ({
      id: link.student_id,
      name: link.students?.preferred_name || link.students?.full_name || "Criança",
    }));

  const docBySlug = new Map((documents ?? []).map((doc: any) => [doc.public_slug, doc]));
  const latest = new Map<string, any>();
  for (const event of events ?? []) {
    const key = `${event.legal_document_id}:${event.student_id || "general"}`;
    if (!latest.has(key)) latest.set(key, event);
  }

  const publishedDecisionDocs = [...generalDecisionSlugs, ...childDecisionSlugs]
    .map((slug) => docBySlug.get(slug))
    .filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow="Ninho da Família"
        title="Privacidade e autorizações"
        description="Leia os documentos publicados e acompanhe, por versão, as escolhas registradas pela sua conta. Autorizações opcionais ficam separadas dos Termos e da Política de Privacidade."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel family-highlight">
        <div className="panel-head">
          <div>
            <h2>Como o registro funciona</h2>
            <p>O portal guarda o documento e a versão publicados, o usuário autenticado e a data/hora do servidor. Um novo documento publicado gera uma nova decisão, sem apagar o histórico anterior.</p>
          </div>
        </div>
        <div className="notice">O contrato de prestação de serviços continua sendo assinado na área <Link href="/familia/contrato">Contrato</Link>. Esta tela não duplica a assinatura contratual.</div>
      </section>

      {!publishedDecisionDocs.length ? (
        <section className="panel">
          <EmptyState
            title="Documentos em revisão"
            description="Os textos jurídicos ainda estão em rascunho. Assim que uma versão revisada for publicada pela administração, ela aparecerá aqui para leitura e registro."
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Documentos gerais da conta</h2>
            <p>Termos e Política de Privacidade são registrados pela conta autenticada do responsável.</p>
          </div>
        </div>
        <div className="form-stack">
          {generalDecisionSlugs.map((slug) => {
            const doc: any = docBySlug.get(slug);
            if (!doc) return null;
            const event = latest.get(`${doc.id}:general`);
            return (
              <article className="mission-card" key={doc.id}>
                <div className="flex space-between gap-8 wrap">
                  <div>
                    <Badge tone="blue">v{doc.version}</Badge>
                    <h3>{doc.title}</h3>
                    <p>{doc.document_type}</p>
                  </div>
                  <Badge tone={decisionTone(event?.decision)}>{decisionLabel(event?.decision)}</Badge>
                </div>
                {event ? <small className="muted">Registrado em {dt(event.occurred_at)} · versão {event.document_version}</small> : null}
                <div className="flex gap-8 wrap mt-12">
                  <Link className="button button-secondary button-small" href={`/legal/${doc.public_slug}`} target="_blank">Ler documento</Link>
                  {event?.decision !== "accepted" ? (
                    <form action={recordFamilyLegalDecision}>
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="decision" value="accepted" />
                      <button className="button button-primary button-small" type="submit">Li e concordo</button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Decisões por criança</h2>
            <p>Consentimentos específicos e autorização de imagem/voz são registrados separadamente para cada criança vinculada.</p>
          </div>
        </div>

        {!children.length ? <EmptyState title="Nenhuma criança vinculada" description="Quando o vínculo for concluído, as autorizações específicas aparecerão aqui." /> : null}

        <div className="form-stack">
          {children.map((child) => (
            <article className="family-upload-card" key={child.id}>
              <h3>{child.name}</h3>
              <div className="grid-2 mt-12">
                {childDecisionSlugs.map((slug) => {
                  const doc: any = docBySlug.get(slug);
                  if (!doc) return (
                    <div className="mission-card" key={`${child.id}-${slug}`}>
                      <Badge tone="neutral">Em revisão</Badge>
                      <h3>{slug === "autorizacao-imagem-voz-producoes" ? "Imagem, voz e produções" : "Consentimento de dados"}</h3>
                      <p className="muted">Nenhuma versão publicada ainda.</p>
                    </div>
                  );

                  const event = latest.get(`${doc.id}:${child.id}`);
                  const imageAuthorization = slug === "autorizacao-imagem-voz-producoes";
                  return (
                    <div className="mission-card" key={`${child.id}-${doc.id}`}>
                      <div className="flex space-between gap-8 wrap">
                        <Badge tone="blue">v{doc.version}</Badge>
                        <Badge tone={decisionTone(event?.decision)}>{decisionLabel(event?.decision)}</Badge>
                      </div>
                      <h3>{doc.title}</h3>
                      <p>{imageAuthorization ? "Autorização opcional e separada para uso de imagem, voz ou produções nos limites do documento publicado." : "Consentimento específico, quando essa for a base aplicável ao tratamento descrito no documento."}</p>
                      {event ? <small className="muted">Última decisão: {dt(event.occurred_at)}</small> : null}
                      <div className="flex gap-8 wrap mt-12">
                        <Link className="button button-secondary button-small" href={`/legal/${doc.public_slug}`} target="_blank">Ler</Link>
                        <form action={recordFamilyLegalDecision}>
                          <input type="hidden" name="documentId" value={doc.id} />
                          <input type="hidden" name="studentId" value={child.id} />
                          <input type="hidden" name="decision" value="accepted" />
                          <button className="button button-primary button-small" type="submit">Autorizar</button>
                        </form>
                        <form action={recordFamilyLegalDecision}>
                          <input type="hidden" name="documentId" value={doc.id} />
                          <input type="hidden" name="studentId" value={child.id} />
                          <input type="hidden" name="decision" value="declined" />
                          <button className="button button-secondary button-small" type="submit">Não autorizar</button>
                        </form>
                        {event?.decision === "accepted" ? (
                          <form action={recordFamilyLegalDecision}>
                            <input type="hidden" name="documentId" value={doc.id} />
                            <input type="hidden" name="studentId" value={child.id} />
                            <input type="hidden" name="decision" value="revoked" />
                            <button className="button button-secondary button-small" type="submit">Revogar autorização</button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Leia também</h2>
            <p>Outros documentos publicados ficam disponíveis para consulta sem criar um aceite duplicado desnecessário.</p>
          </div>
        </div>
        <div className="flex gap-8 wrap">
          {informationalSlugs.map((slug) => {
            const doc: any = docBySlug.get(slug);
            return doc ? <Link className="button button-secondary button-small" href={`/legal/${doc.public_slug}`} key={doc.id}>{doc.title}</Link> : null;
          })}
          <Link className="button button-secondary button-small" href="/familia/contrato">Ver contrato</Link>
        </div>
      </section>
    </>
  );
}
