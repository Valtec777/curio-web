import { getCurrentTeacher } from "@/lib/teacher";
import { PageHeader, EmptyState } from "@/components/ui";
import { createMission } from "../actions";

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const params = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil incompleto" description="Falta o registro de professor." />;

  const [{ data: subjects }, { data: skills }] = await Promise.all([
    supabase.from("subjects").select("id, name").eq("active", true).order("name"),
    supabase.from("skills").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Missão Cuca"
        title="Criar nova missão"
        description="Crie um desafio interativo ligado a uma habilidade. A questão pode ser discursiva, múltipla escolha ou verdadeiro/falso."
      />

      {params.erro && <div className="form-message form-error">{params.erro}</div>}

      <section className="panel">
        <form action={createMission} className="form-stack">
          <div className="form-row">
            <div className="field">
              <label>Título</label>
              <input className="input" name="title" placeholder="Ex.: Detetive das pistas do texto" required />
            </div>
            <div className="field">
              <label>Tempo estimado</label>
              <input className="input" name="estimatedMinutes" type="number" min="5" max="180" defaultValue="20" required />
            </div>
          </div>

          <div className="field">
            <label>Objetivo da missão</label>
            <textarea className="textarea" name="objective" placeholder="Explique em uma frase o que a criança deve conseguir ao terminar." required />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Área / matéria</label>
              <select className="select" name="subjectId" defaultValue="">
                <option value="">Não definida</option>
                {(subjects ?? []).map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Habilidade principal</label>
              <select className="select" name="skillId" required defaultValue="">
                <option value="" disabled>Selecione</option>
                {(skills ?? []).map((skill) => (
                  <option key={skill.id} value={skill.id}>{skill.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Questão / desafio</label>
            <textarea className="textarea" name="prompt" placeholder="Escreva o enunciado da questão." required />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Tipo de questão</label>
              <select className="select" name="questionType" defaultValue="open_text" required>
                <option value="open_text">Discursiva</option>
                <option value="multiple_choice">Múltipla escolha</option>
                <option value="true_false">Verdadeiro ou falso</option>
              </select>
            </div>
            <div className="field">
              <label>Resposta correta (quando houver alternativas)</label>
              <input className="input" name="correctAnswer" placeholder="Copie exatamente a alternativa correta" />
            </div>
          </div>

          <div className="field">
            <label>Alternativas para múltipla escolha</label>
            <textarea className="textarea" name="choices" placeholder={"Uma alternativa por linha.\nEx.: 1/2\n2/4\n3/5"} />
            <small className="muted">Em verdadeiro/falso, use como resposta correta exatamente “Verdadeiro” ou “Falso”.</small>
          </div>

          <div className="field">
            <label>Pista opcional</label>
            <input className="input" name="hint" placeholder="Ajude sem entregar a resposta." />
          </div>

          <div className="notice">
            <strong>Missão = quiz/interação dentro do Curió.</strong> Ela é salva como rascunho e só chega ao aluno quando você publicar. Para atividade de papel/PDF, use Caderno Curió no Gerador/Materiais.
          </div>

          <button className="button button-primary" type="submit">Salvar Missão Cuca</button>
        </form>
      </section>
    </>
  );
}
