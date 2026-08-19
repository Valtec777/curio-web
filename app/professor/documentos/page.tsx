import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";

const MANUAL_HREF = "/documentos/manual-do-instrutor-plumareli-v2.pdf";

export default async function TeacherDocumentsPage() {
  const { teacher } = await getCurrentTeacher();

  if (!teacher) {
    return (
      <EmptyState
        title="Perfil de professor ainda não vinculado"
        description="A administração precisa concluir o vínculo do seu usuário com o perfil de professor."
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Professor • Apoio"
        title="Documentos"
        description="Guias oficiais para consultar quando surgir uma dúvida na rotina de acompanhamento."
      />

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="flex gap-8 wrap">
              <Badge tone="blue">Guia oficial</Badge>
              <Badge tone="pink">60 páginas</Badge>
              <Badge tone="green">Versão 2</Badge>
            </div>
            <h2 className="mt-12">Manual do Instrutor Plumareli</h2>
            <p>
              Consulte antes do primeiro aluno, ao preparar aulas, registrar evidências,
              conversar com a família ou lidar com situações que pedem orientação.
            </p>
          </div>
        </div>

        <div className="grid-2">
          <article className="mission-card">
            <strong>Para usar no dia a dia</strong>
            <p>
              O manual reúne a jornada do aluno, preparação de aula, atividades,
              correções, reuniões com responsáveis, comunicação, privacidade e checklists.
            </p>
            <div className="flex gap-8 wrap">
              <a className="button button-primary" href={MANUAL_HREF} target="_blank" rel="noreferrer">
                Abrir manual
              </a>
              <a className="button button-secondary" href={MANUAL_HREF} download>
                Baixar PDF
              </a>
            </div>
          </article>

          <article className="mission-card">
            <strong>Não precisa decorar tudo</strong>
            <p>
              Volte ao documento sempre que precisar. Ele foi organizado para funcionar
              como material de consulta, e não como uma prova de treinamento.
            </p>
            <small className="muted">Última revisão desta biblioteca: agosto de 2026.</small>
          </article>
        </div>
      </section>
    </>
  );
}
