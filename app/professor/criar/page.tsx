import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { createContentPreparationDraft } from "./actions";

const creationTypes = [
  { href: "/professor/missoes/nova", title: "Missão Cuca", description: "Monte questões, alternativas, respostas abertas, gabarito, prazo e alunos.", className: "is-mission" },
  { href: "/professor/materiais/novo?tipo=notebook", title: "Atividade / Caderno", description: "Prepare treino fora da tela, com PDF ou imagem e envio da atividade pelo aluno.", className: "is-notebook" },
  { href: "/professor/materiais/novo?tipo=material", title: "Material de apoio", description: "Publique explicações, leituras, PDFs, imagens e materiais de consulta.", className: "is-material" },
  { href: "/professor/avaliacoes/nova", title: "Avaliação", description: "Registre prova ou avaliação, matéria, data, conteúdo, alunos e arquivo opcional.", className: "is-assessment" },
];

const questionOptions = [
  ["multiple_choice", "Múltipla escolha"], ["true_false", "Verdadeiro ou falso"], ["open_text", "Discursiva"],
  ["matching", "Associação"], ["fill_blank", "Complete a frase"], ["ordering", "Ordenação"],
  ["interpretation", "Interpretação"], ["problem", "Situação-problema"],
];
const formatOptions = [
  ["mission", "Missão"], ["quiz", "Quiz"], ["activity", "Atividade"], ["material", "Material"], ["assessment", "Avaliação"], ["notebook_pdf", "Caderno / PDF"],
];

function draftStatus(status: string) {
  if (status === "review") return <Badge tone="blue">Em revisão</Badge>;
  if (status === "converted") return <Badge tone="green">Convertido</Badge>;
  return <Badge tone="yellow">Rascunho</Badge>;
}

export default async function TeacherCreatePage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;
  const [{ data: subjects }, { data: grades }, { data: drafts }] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("grades").select("id,name").eq("active", true).order("sort_order"),
    supabase.from("content_preparation_drafts").select("id,title,theme,status,source_file_name,target_formats,updated_at").eq("created_by_teacher_id", teacher.id).neq("status", "archived").order("updated_at", { ascending: false }).limit(8),
  ]);

  return <>
    <PageHeader eyebrow="Professor • Criar e publicar" title="Criar conteúdo" description="Comece por uma fonte ou abra diretamente o editor final. Todo conteúdo continua revisável antes de chegar ao aluno." />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}
    {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

    <section className="panel teacher-create-manual-hub">
      <div className="panel-head"><div><h2>Preparar conteúdo a partir de uma fonte</h2><p>Cole um texto, anexe PDF/DOCX/PPTX/imagem ou combine arquivo + instruções. O resultado entra primeiro como rascunho revisável.</p></div></div>
      <div className="notice mb-16"><strong>Revisão humana obrigatória.</strong> O arquivo é salvo como fonte. O processador automático que fará a leitura e preencherá o rascunho será conectado depois; até lá, o sistema não finge que interpretou um PDF que ainda não foi processado.</div>
      <form action={createContentPreparationDraft} className="form-stack">
        <div className="form-row"><div className="field"><label>Título de trabalho</label><input className="input" name="title" placeholder="Ex.: Frações — revisão" /></div><div className="field"><label>Tema</label><input className="input" name="theme" placeholder="Frações, sistema solar, interpretação..." /></div></div>
        <div className="field"><label>Texto / instruções</label><textarea className="textarea" name="sourceText" placeholder="Cole o conteúdo, resumo, capítulo ou instruções para a preparação..." /></div>
        <div className="field"><label>Arquivo fonte <span className="field-optional">PDF, DOCX, PPTX, TXT ou imagem · até 15 MB</span></label><input className="input" type="file" name="sourceFile" accept="application/pdf,.pdf,.docx,.pptx,text/plain,image/png,image/jpeg,image/webp" /></div>
        <div className="form-row"><div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Não definida</option>{subjects?.map((s: any) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></div><div className="field"><label>Série / ano</label><select className="select" name="gradeId" defaultValue=""><option value="">Não definida</option>{grades?.map((g: any) => <option value={g.id} key={g.id}>{g.name}</option>)}</select></div></div>
        <div className="field"><label>Objetivo</label><textarea className="textarea" name="objective" placeholder="O que o aluno deve aprender, praticar ou demonstrar?" /></div>
        <div className="form-row"><div className="field"><label>Habilidade</label><input className="input" name="skillText" placeholder="Descrição ou código da habilidade" /></div><div className="field"><label>Faixa etária</label><input className="input" name="ageLabel" placeholder="Ex.: 12 a 14 anos" /></div></div>
        <div className="form-row"><div className="field"><label>Dificuldade</label><select className="select" name="difficulty" defaultValue="medium"><option value="easy">Mais acessível</option><option value="medium">Intermediária</option><option value="hard">Desafiadora</option></select></div><div className="field"><label>Quantidade desejada de questões</label><input className="input" type="number" name="desiredQuestionCount" min="0" max="50" defaultValue="10" /></div><div className="field"><label>Duração estimada (min)</label><input className="input" type="number" name="estimatedMinutes" min="1" max="300" defaultValue="20" /></div></div>
        <div className="field"><label>Tipos de questão desejados</label><div className="flex gap-8 wrap">{questionOptions.map(([value, label]) => <label className="consent-line" key={value}><input type="checkbox" name="questionTypes" value={value} defaultChecked={["multiple_choice", "true_false", "open_text"].includes(value)} /> {label}</label>)}</div></div>
        <div className="field"><label>O que você pretende criar com esta fonte?</label><div className="flex gap-8 wrap">{formatOptions.map(([value, label]) => <label className="consent-line" key={value}><input type="checkbox" name="targetFormats" value={value} /> {label}</label>)}</div></div>
        <div className="field"><label>Observações para a preparação</label><textarea className="textarea" name="notes" placeholder="Ex.: linguagem simples, priorizar interpretação, evitar pegadinhas..." /></div>
        <button className="button button-primary" type="submit">Criar rascunho para revisão</button>
      </form>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Rascunhos recentes</h2><p>Volte a qualquer preparação sem perder o arquivo ou as questões que já revisou.</p></div></div>
      {drafts?.length ? <div className="form-stack">{drafts.map((draft: any) => <article className="mission-card" key={draft.id}><div className="flex space-between gap-8 wrap"><div>{draftStatus(draft.status)}<h3>{draft.title || draft.theme || "Conteúdo sem título"}</h3><p>{draft.source_file_name ? `Fonte: ${draft.source_file_name}` : "Fonte em texto"}</p><small className="muted">Formatos: {(draft.target_formats || []).join(", ") || "a definir"}</small></div><Link className="button button-secondary button-small" href={`/professor/criar/revisao/${draft.id}`}>Abrir revisão</Link></div></article>)}</div> : <EmptyState title="Nenhum rascunho ainda" description="Crie uma preparação acima ou abra diretamente um dos editores manuais." />}
    </section>

    <section className="panel teacher-create-manual-hub">
      <div className="panel-head"><div><h2>Ou abrir o editor final diretamente</h2><p>Para quando você já sabe exatamente o que quer cadastrar.</p></div></div>
      <div className="teacher-create-launch-grid teacher-create-launch-grid-clean">{creationTypes.map((type) => <Link className={`teacher-create-launch ${type.className}`} href={type.href} key={type.href}><span className="teacher-create-format-mark" aria-hidden="true" /><strong>{type.title}</strong><span>{type.description}</span><small>Abrir editor</small></Link>)}</div>
    </section>

    <section className="panel teacher-create-guidance"><div className="panel-head"><div><h2>Fluxo de segurança pedagógica</h2><p>Fonte → estrutura editável → revisão → editor final → publicação.</p></div></div><div className="teacher-create-steps"><article><strong>1</strong><div><h3>Forneça a fonte</h3><p>Texto, PDF, DOCX, PPTX ou imagem.</p></div></article><article><strong>2</strong><div><h3>Revise a estrutura</h3><p>Edite título, objetivo, questão, alternativa e resposta.</p></div></article><article><strong>3</strong><div><h3>Leve ao formato final</h3><p>Missão, Caderno, Material ou Avaliação continuam usando os fluxos já existentes.</p></div></article><article><strong>4</strong><div><h3>Publique conscientemente</h3><p>Nada é enviado automaticamente para a criança.</p></div></article></div></section>
  </>;
}
