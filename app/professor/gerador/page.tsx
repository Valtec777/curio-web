import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";

const flows = [
  {
    href: "/professor/missoes/nova",
    template: "/modelos/professor/missao",
    title: "Missão",
    description: "Baixe o modelo, gere a missão no ChatGPT e importe o PDF para preencher dados, habilidade e questões.",
  },
  {
    href: "/professor/materiais/novo?tipo=notebook",
    template: "/modelos/professor/material",
    title: "Atividade / Caderno",
    description: "Use o modelo de material para preparar a atividade e reaproveitar o próprio PDF como arquivo final quando fizer sentido.",
  },
  {
    href: "/professor/materiais/novo?tipo=material",
    template: "/modelos/professor/material",
    title: "Material de apoio",
    description: "O mesmo modelo identifica Material de apoio, preenche os campos e mantém a escolha de alunos dentro do Plumareli.",
  },
  {
    href: "/professor/avaliacoes/nova",
    template: "/modelos/professor/avaliacao",
    title: "Avaliação",
    description: "Preencha título, matéria, ano, data, conteúdo, observação e critério de nota a partir do PDF.",
  },
] as const;

export default async function TeacherGeneratorPage() {
  const { teacher } = await getCurrentTeacher();
  if (!teacher) return null;

  return (
    <>
      <PageHeader
        eyebrow="Professor • Criação rápida"
        title="Criar a partir de um modelo PDF"
        description="A geração genérica foi substituída por modelos próprios dentro de Missões, Materiais e Avaliações. Escolha o formato, baixe o PDF, gere no ChatGPT e importe de volta para preencher o editor correto."
        action={<Link className="button button-secondary" href="/professor/criar">Preparação manual</Link>}
      />

      <section className="panel teacher-create-manual-hub">
        <div className="notice mb-16"><strong>Novo fluxo:</strong> o PDF só preenche o formulário. O professor continua revisando o conteúdo, escolhendo os alunos e decidindo quando publicar.</div>
        <div className="teacher-create-launch-grid teacher-create-launch-grid-clean">
          {flows.map((flow) => (
            <article className="teacher-create-launch" key={`${flow.href}-${flow.title}`}>
              <span className="teacher-create-format-mark" aria-hidden="true" />
              <strong>{flow.title}</strong>
              <span>{flow.description}</span>
              <div className="flex gap-8 wrap mt-8">
                <Link className="button button-primary button-small" href={flow.href}>Abrir editor</Link>
                <a className="button button-secondary button-small" href={flow.template} download>Baixar modelo PDF</a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
