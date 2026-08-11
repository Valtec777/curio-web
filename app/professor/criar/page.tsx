import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";

const creationTypes = [
  {
    href: "/professor/missoes/nova",
    title: "Missão Cuca",
    description: "Monte várias questões, alternativas, verdadeiro ou falso, respostas abertas, gabarito, prazo e alunos.",
    className: "is-mission",
  },
  {
    href: "/professor/materiais/novo?tipo=notebook",
    title: "Atividade / Caderno",
    description: "Prepare treino para fazer fora da tela, com PDF ou imagem, prazo e envio da atividade pelo aluno.",
    className: "is-notebook",
  },
  {
    href: "/professor/materiais/novo?tipo=material",
    title: "Material de apoio",
    description: "Publique explicações, leituras, PDFs, imagens e materiais de consulta para os alunos escolhidos.",
    className: "is-material",
  },
  {
    href: "/professor/avaliacoes/nova",
    title: "Avaliação",
    description: "Registre prova ou avaliação, matéria, data, conteúdo, alunos e arquivo opcional.",
    className: "is-assessment",
  },
];

export default async function TeacherCreatePage() {
  const { teacher } = await getCurrentTeacher();
  if (!teacher) return null;

  return (
    <>
      <PageHeader
        eyebrow="Professor • Criar e publicar"
        title="Criar conteúdo"
        description="Escolha o formato e abra apenas o editor que precisa. A criação e a revisão continuam nas mãos do professor."
      />

      <section className="panel teacher-create-manual-hub">
        <div className="panel-head">
          <div>
            <h2>O que você quer preparar?</h2>
            <p>Cada formato tem sua própria estrutura para a tela continuar simples e confortável.</p>
          </div>
        </div>
        <div className="teacher-create-launch-grid teacher-create-launch-grid-clean">
          {creationTypes.map((type) => (
            <Link className={`teacher-create-launch ${type.className}`} href={type.href} key={type.href}>
              <span className="teacher-create-format-mark" aria-hidden="true" />
              <strong>{type.title}</strong>
              <span>{type.description}</span>
              <small>Abrir editor</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel teacher-create-guidance">
        <div className="panel-head"><div><h2>Fluxo simples</h2><p>Sem gerador automático e sem conteúdo publicado sem revisão humana.</p></div></div>
        <div className="teacher-create-steps">
          <article><strong>1</strong><div><h3>Escolha o formato</h3><p>Missão, Caderno, Material ou Avaliação.</p></div></article>
          <article><strong>2</strong><div><h3>Monte o conteúdo</h3><p>Use o editor próprio daquele formato e anexe o arquivo quando precisar.</p></div></article>
          <article><strong>3</strong><div><h3>Escolha os alunos</h3><p>Envie para um aluno, vários alunos ou selecione todos quando fizer sentido.</p></div></article>
          <article><strong>4</strong><div><h3>Revise e publique</h3><p>O professor continua responsável pelo conteúdo antes de ele chegar ao aluno.</p></div></article>
        </div>
      </section>
    </>
  );
}
