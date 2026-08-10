import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const typeLabel: Record<string, string> = {
  mission: "Missão",
  assessment: "Avaliação / prova",
  report: "Relatório",
  material: "Material",
  notebook: "Caderno",
  communication: "Mensagem",
  certificate: "Certificado",
};

export default async function AdminTemplatesPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("content_templates")
    .select("id,name,template_type,description,config,shared,active,created_at")
    .order("active", { ascending: false })
    .order("name");

  return (
    <>
      <PageHeader
        eyebrow="Admin • Pedagógico"
        title="Modelos"
        description="Veja o que cada modelo contém antes de usar. A estrutura aparece em linguagem simples, sem códigos internos."
      />

      <section className="template-help-card">
        <div>
          <Badge tone="purple">Biblioteca CURIÓ</Badge>
          <h2>Abra um modelo para ver como ele está organizado.</h2>
          <p>Aqui você confere títulos, blocos e ordem das seções. A revisão visual dos PDFs continua separada para preservar o acabamento de impressão.</p>
        </div>
        <span aria-hidden="true">⌁</span>
      </section>

      <section className="panel">
        {templates?.length ? (
          <div className="template-preview-grid">
            {templates.map((template: any) => {
              const sections = Array.isArray(template.config?.sections) ? template.config.sections : [];
              const humanType = typeLabel[template.template_type] || "Modelo";
              return (
                <article className="template-preview-card" key={template.id}>
                  <div className="flex gap-8 wrap">
                    <Badge tone={template.active ? "green" : "neutral"}>{template.active ? "Disponível" : "Inativo"}</Badge>
                    <Badge tone="blue">{humanType}</Badge>
                  </div>
                  <h3>{template.name.replace(/\s+[—-]\s+[A-Z]{2,}[A-Z0-9:-]*$/i, "")}</h3>
                  <p>{template.description || "Modelo reutilizável do CURIÓ."}</p>
                  <details className="template-preview-details">
                    <summary>Ver como está organizado</summary>
                    <div className="template-preview-body">
                      {sections.length ? (
                        <ol className="template-section-list">
                          {sections.map((section: string, index: number) => <li key={`${template.id}-${index}`}>{section}</li>)}
                        </ol>
                      ) : (
                        <p className="muted text-small">Este modelo ainda não tem uma estrutura textual detalhada cadastrada.</p>
                      )}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhum modelo cadastrado" description="Os modelos oficiais aparecerão aqui quando forem cadastrados." />}
      </section>
    </>
  );
}
