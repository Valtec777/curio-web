import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { TeacherActivityGeneratorForm } from "./generator-form";

function formatLabel(value: string) {
  const labels: Record<string, string> = {
    mission: "Missão",
    quiz: "Quiz",
    activity: "Atividade",
    material: "Material",
    assessment: "Avaliação",
    notebook_pdf: "Caderno",
  };
  return labels[value] || value;
}

export default async function TeacherGeneratorPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;

  const [{ data: subjects }, { data: grades }, { data: drafts }] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("grades").select("id,name").eq("active", true).order("sort_order"),
    supabase
      .from("content_preparation_drafts")
      .select("id,title,status,target_formats,desired_question_count,updated_at")
      .eq("created_by_teacher_id", teacher.id)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Professor • Gerar atividades"
        title="Geração automática de atividades"
        description="Defina o formato, o título, as questões e as explicações. Ao clicar em gerar, o sistema prepara o rascunho completo para você revisar."
        action={<Link className="button button-secondary" href="/professor/criar">Abrir preparação manual</Link>}
      />

      {query.erro ? <div className="form-message form-error">{query.erro}</div> : null}
      {query.sucesso ? <div className="form-message form-success">{query.sucesso}</div> : null}

      <section className="panel generator-source-card">
        <div className="panel-head">
          <div>
            <h2>Gerar em um clique</h2>
            <p>Você informa o que quer ou anexa uma fonte. O gerador lê a solicitação, cria o conteúdo e preenche as questões, respostas e explicações escolhidas.</p>
          </div>
          <Badge tone="green">Geração conectada</Badge>
        </div>
        <TeacherActivityGeneratorForm
          subjects={(subjects ?? []).map((item: any) => ({ id: item.id, name: item.name }))}
          grades={(grades ?? []).map((item: any) => ({ id: item.id, name: item.name }))}
        />
      </section>

      <section className="panel family-highlight">
        <div className="panel-head">
          <div>
            <h2>Um modelo para todos os formatos</h2>
            <p>O modelo universal identifica o tipo solicitado e organiza título, matéria, série, objetivo, quantidade e tipos de questão, explicações e instruções.</p>
          </div>
          <a className="button button-secondary button-small" href="/modelos/modelo-geracao-atividade.txt" download>Baixar modelo</a>
        </div>
        <p className="mb-0">Preencha o TXT ou abra o arquivo em Docs/Word e salve como DOCX ou PDF. Depois escolha o formato na tela e anexe a fonte. PPTX também pode ser usado como fonte.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Rascunhos gerados recentemente</h2><p>Abra qualquer geração para revisar antes de transformar em Missão, Quiz, Atividade, Material, Avaliação ou Caderno.</p></div></div>
        {drafts?.length ? (
          <div className="form-stack">
            {drafts.map((draft: any) => (
              <article className="mission-card" key={draft.id}>
                <div className="flex space-between gap-8 wrap">
                  <div>
                    <div className="flex gap-8 wrap">
                      <Badge tone={draft.status === "converted" ? "green" : "blue"}>{draft.status === "converted" ? "Convertido" : "Em revisão"}</Badge>
                      {(draft.target_formats || []).map((format: string) => <Badge tone="neutral" key={format}>{formatLabel(format)}</Badge>)}
                    </div>
                    <h3>{draft.title || "Conteúdo sem título"}</h3>
                    <p>{draft.desired_question_count} questão(ões) solicitada(s)</p>
                  </div>
                  <Link className="button button-secondary button-small" href={`/professor/criar/revisao/${draft.id}`}>Abrir revisão</Link>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Nenhuma geração ainda" description="Use o formulário acima para criar o primeiro rascunho automático." />}
      </section>

      <section className="panel teacher-create-guidance">
        <div className="panel-head"><div><h2>Depois da geração</h2><p>O fluxo continua sob controle do professor.</p></div></div>
        <div className="teacher-create-steps">
          <article><strong>1</strong><div><h3>Gerar</h3><p>O sistema prepara o conteúdo completo a partir das suas instruções e/ou arquivo.</p></div></article>
          <article><strong>2</strong><div><h3>Revisar</h3><p>Você corrige título, enunciados, alternativas, gabaritos, explicações e pistas.</p></div></article>
          <article><strong>3</strong><div><h3>Escolher alunos</h3><p>No editor final, selecione os alunos que devem receber a atividade.</p></div></article>
          <article><strong>4</strong><div><h3>Publicar</h3><p>Nada é enviado automaticamente. A publicação continua sendo uma decisão do professor.</p></div></article>
        </div>
      </section>
    </>
  );
}
