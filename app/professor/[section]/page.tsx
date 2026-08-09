import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { createSupportTicket } from "@/app/support-actions";
import { queueCurioGeneration } from "@/app/professor/generator-actions";
import { removeTeacherResource, setTeacherResourceStatus, updateTeacherResource } from "@/app/professor/manage-actions";
import { editTeamMessage, removeTeamMessage } from "@/app/message-actions";

const sectionCopy: Record<string, { eyebrow: string; title: string; description: string }> = {
  agenda: {
    eyebrow: "Professor • Agenda",
    title: "Agenda",
    description: "Encontros, aulas e compromissos pedagógicos em um só lugar.",
  },
  turmas: {
    eyebrow: "Professor • Turmas",
    title: "Turmas",
    description: "A turma oficial organiza vínculos. Grupos pedagógicos não alteram a matrícula.",
  },
  mapa: {
    eyebrow: "Professor • Mapa Pedagógico",
    title: "Mapa Pedagógico 360º",
    description: "Conteúdo, habilidade, evidência, domínio, autonomia, confiança, evolução e próxima ação.",
  },
  grupos: {
    eyebrow: "Professor • Grupos Pedagógicos",
    title: "Grupos Pedagógicos",
    description: "Agrupe necessidades semelhantes para intervir em lote sem alterar a turma oficial.",
  },
  materiais: {
    eyebrow: "Professor • Materiais",
    title: "Materiais",
    description: "Biblioteca de materiais que podem ser atribuídos a aluno, turma ou grupo pedagógico.",
  },
  gerador: {
    eyebrow: "Professor • Gerador",
    title: "Gerador CURIÓ",
    description: "Gere uma Missão Cuca e revise o mapeamento pedagógico antes de publicar.",
  },
  conteudos: {
    eyebrow: "Professor • Conteúdos",
    title: "Conteúdos",
    description: "Conteúdo e habilidade permanecem separados para o mapa pedagógico continuar preciso.",
  },
  avaliacoes: {
    eyebrow: "Professor • Avaliações",
    title: "Avaliações",
    description: "Avaliações também geram evidências por questão e habilidade, sem reduzir tudo a uma nota.",
  },
  mensagens: {
    eyebrow: "Professor • Mensagens",
    title: "Mensagens",
    description: "Comunicação organizada com famílias e equipe CURIÓ.",
  },
  relatorios: {
    eyebrow: "Professor • Relatórios",
    title: "Relatórios Pedagógicos",
    description: "O relatório é gerado a partir dos dados estruturados e das evidências rastreáveis.",
  },
  perfil: {
    eyebrow: "Professor • Perfil",
    title: "Meu perfil",
    description: "Dados profissionais, especialidades e matérias acompanhadas.",
  },
  suporte: {
    eyebrow: "Professor • Suporte",
    title: "Suporte Curió",
    description: "Abra uma solicitação e acompanhe o andamento com a equipe administrativa.",
  },
};

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function statusTone(status?: string | null): "green" | "yellow" | "pink" | "blue" | "neutral" {
  if (!status) return "neutral";
  if (["active", "published", "completed", "paid", "ready"].includes(status)) return "green";
  if (status === "archived") return "neutral";
  if (["pending", "draft", "in_progress", "scheduled", "processing"].includes(status)) return "yellow";
  if (["cancelled", "failed", "overdue"].includes(status)) return "pink";
  return "blue";
}

export default async function TeacherSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { section } = await params;
  const query = await searchParams;
  const copy = sectionCopy[section];
  if (!copy) notFound();

  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) {
    return (
      <EmptyState
        title="Perfil de professor ainda não vinculado"
        description="A administração precisa concluir o vínculo do seu usuário com o perfil de professor."
      />
    );
  }

  if (section === "agenda") {
    const { data: events } = await supabase
      .from("agenda_events")
      .select("id,title,description,event_type,starts_at,ends_at,status,meeting_url,location")
      .eq("created_by_teacher_id", teacher.id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(30);

    return (
      <>
        <PageHeader {...copy} />
        <section className="panel">
          <div className="panel-head"><div><h2>Próximos encontros</h2><p>Resumo primeiro; detalhes quando você abrir cada compromisso.</p></div></div>
          {events?.length ? (
            <div className="form-stack">
              {events.map((event: any) => (
                <article className="mission-card" key={event.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div><strong>{event.title}</strong><p>{event.description || event.event_type}</p></div>
                    <Badge tone={statusTone(event.status)}>{event.status}</Badge>
                  </div>
                  <small className="muted">{dateTime(event.starts_at)}{event.location ? ` • ${event.location}` : ""}</small>
                  {event.meeting_url && <p className="mb-0"><a href={event.meeting_url}>Abrir encontro online →</a></p>}
                </article>
              ))}
            </div>
          ) : <EmptyState title="Agenda livre" description="Nenhum encontro futuro está cadastrado para você." />}
        </section>
      </>
    );
  }

  if (section === "turmas") {
    const { data: links } = await supabase
      .from("class_teachers")
      .select("class_id,classes(id,name,school_name,academic_year,grades(name))")
      .eq("teacher_id", teacher.id)
      .eq("active", true);

    return (
      <>
        <PageHeader {...copy} />
        <section className="panel">
          {links?.length ? (
            <div className="grid-3">
              {links.map((link: any) => (
                <article className="mission-card" key={link.class_id}>
                  <Badge tone="blue">{link.classes?.grades?.name || "Série"}</Badge>
                  <h3>{link.classes?.name}</h3>
                  <p>{link.classes?.school_name || "Turma CURIÓ"}</p>
                  <small className="muted">Ano letivo {link.classes?.academic_year || "—"}</small>
                </article>
              ))}
            </div>
          ) : <EmptyState title="Nenhuma turma vinculada" description="Turmas oficiais vinculadas a você aparecerão aqui." />}
        </section>
      </>
    );
  }

  if (section === "mapa") {
    const { data: studentLinks } = await supabase
      .from("teacher_students")
      .select("student_id,students(id,preferred_name,full_name)")
      .eq("teacher_id", teacher.id)
      .eq("active", true);

    const studentIds = (studentLinks ?? []).map((item: any) => item.student_id);
    const studentName = new Map(
      (studentLinks ?? []).map((item: any) => [item.student_id, item.students?.preferred_name || item.students?.full_name || "Aluno"]),
    );

    const { data: states } = studentIds.length
      ? await supabase
          .from("student_skill_states")
          .select("student_id,skill_id,domain_level,autonomy_level,confidence,trend,evidence_count,priority,diagnostic_label,manual_domain_level,manual_priority,needs_teacher_review,skills(name)")
          .in("student_id", studentIds)
          .order("priority", { ascending: false })
          .limit(80)
      : { data: [] as any[] };

    const normalized = (states ?? []).map((state: any) => ({
      ...state,
      effectiveDomain: state.manual_domain_level ?? state.domain_level,
      effectivePriority: state.manual_priority ?? state.priority ?? 0,
    }));
    const priorityCount = normalized.filter((state: any) => state.evidence_count >= 2 && state.effectiveDomain <= 2).length;
    const strengthCount = normalized.filter((state: any) => state.evidence_count >= 2 && state.effectiveDomain >= 3).length;
    const insufficientCount = normalized.filter((state: any) => state.evidence_count < 2 || state.confidence === "low").length;
    const reviewCount = normalized.filter((state: any) => state.needs_teacher_review).length;

    return (
      <>
        <PageHeader
          {...copy}
          action={<Link className="button button-primary" href="/professor/alunos">Abrir alunos</Link>}
        />
        <div className="stats-grid">
          <StatCard value={priorityCount} label="Prioridades" detail="Com evidências repetidas" />
          <StatCard value={strengthCount} label="Facilidades" detail="Domínio 3 ou 4" />
          <StatCard value={insufficientCount} label="Evidência insuficiente" detail="Sem diagnóstico precipitado" />
          <StatCard value={reviewCount} label="Revisões da professora" detail="Automação pede conferência" />
        </div>
        <section className="panel">
          <div className="panel-head">
            <div><h2>Habilidades que merecem atenção</h2><p>Uma dificuldade em uma habilidade não transforma a matéria inteira em dificuldade.</p></div>
          </div>
          {normalized.length ? (
            <div className="skill-list">
              {normalized.slice(0, 16).map((state: any) => (
                <article className="skill-card" key={`${state.student_id}-${state.skill_id}`}>
                  <div>
                    <h4>{state.skills?.name || "Habilidade"}</h4>
                    <small>{studentName.get(state.student_id)}</small>
                  </div>
                  <div><small>Domínio</small><br /><strong>Nível {state.effectiveDomain}</strong></div>
                  <div><small>Autonomia</small><br /><strong>Nível {state.autonomy_level}</strong></div>
                  <div className="flex gap-8 wrap">
                    <Badge tone={state.confidence === "high" ? "green" : state.confidence === "medium" ? "yellow" : "neutral"}>{state.confidence}</Badge>
                    {state.needs_teacher_review && <Badge tone="pink">Revisar</Badge>}
                    <Link href={`/professor/alunos/${state.student_id}`}>Abrir mapa →</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState title="O mapa ainda está começando" description="As habilidades aparecerão aqui quando houver evidências pedagógicas suficientes." />}
        </section>
      </>
    );
  }

  if (section === "grupos") {
    const { data: groups } = await supabase
      .from("pedagogical_groups")
      .select("id,name,rationale,status,generated_by,created_at,pedagogical_group_students(student_id)")
      .eq("teacher_id", teacher.id)
      .order("created_at", { ascending: false });

    return (
      <>
        <PageHeader {...copy} action={<Link className="button button-primary" href="/professor/mapa">Encontrar necessidades</Link>} />
        <section className="panel">
          {groups?.length ? (
            <div className="grid-3">
              {groups.map((group: any) => (
                <article className="mission-card" key={group.id}>
                  <div className="flex gap-8 wrap"><Badge tone={statusTone(group.status)}>{group.status}</Badge><Badge tone="neutral">{group.generated_by}</Badge></div>
                  <h3>{group.name}</h3>
                  <p>{group.rationale || "Grupo pedagógico para intervenção."}</p>
                  <small className="muted">{group.pedagogical_group_students?.length ?? 0} aluno(s)</small>
                  <p className="mb-0"><Link href="/professor/missoes/nova">Gerar missão para o grupo →</Link></p>
                </article>
              ))}
            </div>
          ) : <EmptyState title="Nenhum grupo pedagógico criado" description="O mapa pode sugerir grupos, mas você decide se deseja utilizá-los." />}
        </section>
      </>
    );
  }

  if (section === "materiais") {
    const [{ data: materials }, { data: notebookActivities }] = await Promise.all([
      supabase.from("materials").select("id,title,description,material_type,status,created_at,subjects(name),contents(name),grades(name)").eq("created_by_teacher_id", teacher.id).order("created_at", { ascending: false }).limit(40),
      supabase.from("notebook_activities").select("id,title,description,status,created_at,subjects(name),contents(name),grades(name)").eq("created_by_teacher_id", teacher.id).order("created_at", { ascending: false }).limit(40),
    ]);

    const resourceCard = (item: any, kind: "material" | "notebook") => (
      <article className="mission-card" key={`${kind}-${item.id}`}>
        <div className="flex gap-8 wrap"><Badge tone={kind === "notebook" ? "pink" : "blue"}>{kind === "notebook" ? "Caderno Curió" : item.material_type || "Material"}</Badge><Badge tone={statusTone(item.status)}>{item.status}</Badge></div>
        <h3>{item.title}</h3><p>{item.description || "Material CURIÓ"}</p>
        <small className="muted">{item.subjects?.name || "Geral"}{item.contents?.name ? ` • ${item.contents.name}` : ""}{item.grades?.name ? ` • ${item.grades.name}` : ""}</small>
        <details className="plan-editor"><summary>Editar</summary><form action={updateTeacherResource} className="form-stack plan-form"><input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={item.id}/><div className="field"><label>Título</label><input className="input" name="title" defaultValue={item.title} required/></div><div className="field"><label>Descrição</label><textarea className="textarea" name="description" defaultValue={item.description || ""}/></div><button className="button button-secondary button-small" type="submit">Salvar alterações</button></form></details>
        <div className="plan-admin-actions">
          {item.status !== "archived" ? <form action={setTeacherResourceStatus}><input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="status" value="archived"/><button className="button button-ghost button-small" type="submit">Arquivar</button></form> : <form action={setTeacherResourceStatus}><input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="status" value="draft"/><button className="button button-secondary button-small" type="submit">Voltar a rascunho</button></form>}
          <form action={removeTeacherResource}><input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={item.id}/><button className="button button-danger button-small" type="submit">Excluir</button></form>
        </div>
      </article>
    );

    return (
      <>
        <PageHeader {...copy} />
        {query.erro && <div className="form-message form-error">{query.erro}</div>}
        {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
        <section className="panel"><div className="panel-head"><div><h2>Materiais digitais e recursos</h2><p>Edite, arquive ou exclua rascunhos sem perder histórico já atribuído.</p></div></div>{materials?.length ? <div className="grid-3">{materials.map((item: any) => resourceCard(item, "material"))}</div> : <EmptyState title="Biblioteca vazia" description="Materiais criados por você aparecerão aqui." />}</section>
        <section className="panel"><div className="panel-head"><div><h2>Atividades do Caderno Curió</h2><p>O caderno fica separado do material digital, mas usa a mesma gestão simples.</p></div></div>{notebookActivities?.length ? <div className="grid-3">{notebookActivities.map((item: any) => resourceCard(item, "notebook"))}</div> : <EmptyState title="Nenhuma atividade de caderno" description="Atividades do Caderno Curió aparecerão aqui quando forem criadas." />}</section>
      </>
    );
  }

  if (section === "gerador") {
    const [{ data: jobs }, { data: studentLinks }, { data: subjects }, { data: grades }, { data: templates }] = await Promise.all([
      supabase
        .from("generation_jobs")
        .select("id,job_type,status,result_entity_type,result_entity_id,error_message,created_at,input")
        .eq("teacher_id", teacher.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("teacher_students")
        .select("student_id,students(id,preferred_name,full_name,grade_id)")
        .eq("teacher_id", teacher.id)
        .eq("active", true),
      supabase.from("subjects").select("id,name").eq("active", true).order("name"),
      supabase.from("grades").select("id,name,sort_order").eq("active", true).order("sort_order"),
      supabase.from("content_templates").select("id,name,template_type,description,config").eq("active", true).eq("shared", true).order("name"),
    ]);

    const curioTemplates = (templates ?? []).filter((template: any) => template.config?.curio_source_code);

    return (
      <>
        <PageHeader {...copy} />
        {query.erro && <div className="form-message form-error">{query.erro}</div>}
        {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

        <section className="panel generator-source-card">
          <div className="panel-head">
            <div>
              <div className="eyebrow">Fonte → modelo Curió → revisão humana</div>
              <h2>Transforme um PDF ou texto em rascunho pedagógico</h2>
              <p>Você envia a fonte e escolhe o produto. O sistema mantém o contrato do modelo Curió e nunca publica automaticamente.</p>
            </div>
          </div>

          <div className="generator-type-guide">
            <article><strong>Missão Cuca = interativa</strong><p>Vira uma atividade dentro do Curió, com questões estruturadas, respostas na tela e correção/evidências.</p></article>
            <article><strong>Caderno Curió = para fora da tela</strong><p>O contrato pede uma folha pronta para impressão/PDF. Ela não vira quiz e fica separada das Missões.</p></article>
          </div>

          <form action={queueCurioGeneration} className="form-stack">
            <div className="form-row">
              <div className="field">
                <label>O que deseja preparar?</label>
                <select className="select" name="outputType" defaultValue="mission_cuca" required>
                  <option value="mission_cuca">Missão Cuca</option>
                  <option value="caderno_curio">Atividade do Caderno Curió</option>
                  <option value="modo_prova">Modo Prova / revisão</option>
                  <option value="diagnostico_inicial">Diagnóstico inicial</option>
                  <option value="plano_30_dias">Plano de aprendizagem — 30 dias</option>
                  <option value="registro_pos_encontro">Registro pós-encontro</option>
                  <option value="relatorio_familia">Relatório mensal da família</option>
                </select>
              </div>
              <div className="field">
                <label>Título ou intenção</label>
                <input className="input" name="titleHint" placeholder="Ex.: Revisão de frações para a prova" />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Aluno (opcional)</label>
                <select className="select" name="studentId" defaultValue="">
                  <option value="">Sem aluno específico</option>
                  {(studentLinks ?? []).map((link: any) => <option value={link.student_id} key={link.student_id}>{link.students?.preferred_name || link.students?.full_name || "Aluno"}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Ano escolar</label>
                <select className="select" name="gradeId" defaultValue="">
                  <option value="">Inferir / escolher depois</option>
                  {(grades ?? []).map((grade: any) => <option value={grade.id} key={grade.id}>{grade.name}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Matéria</label>
              <select className="select" name="subjectId" defaultValue="">
                <option value="">Inferir / escolher depois</option>
                {(subjects ?? []).map((subject: any) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
              </select>
            </div>

            <div className="generator-input-grid">
              <div className="field">
                <label>Cole o texto, instrução ou conteúdo</label>
                <textarea className="textarea generator-prompt" name="prompt" placeholder="Ex.: Crie uma Missão Cuca sobre frações equivalentes. A criança precisa compreender o conceito, testar 3 desafios e explicar com as próprias palavras." />
              </div>
              <div className="generator-upload-drop">
                <strong>Ou anexe a fonte</strong>
                <p>PDF, TXT ou DOCX · até 10 MB</p>
                <input name="sourceFile" type="file" accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
                <small>Use apenas os dados realmente necessários. Evite anexar informações pessoais sem finalidade pedagógica.</small>
              </div>
            </div>

            <div className="generator-contract">
              <strong>Contrato Curió</strong>
              <span>IA prepara rascunho</span><span>Professor revisa</span><span>Sem publicação automática</span><span>Gabarito separado quando aplicável</span>
            </div>

            <button className="button button-primary" type="submit">Preparar rascunho no modelo Curió</button>
          </form>
        </section>

        <section className="panel family-highlight">
          <h2 className="mt-0">Modelos oficiais carregados</h2>
          <p>Os contratos vêm dos documentos em <strong>DOCS CURIO</strong>. A Missão Cuca segue objetivo → explicação → exemplo → prática → pista → Caderno Curió → explicação autoral.</p>
          <div className="asset-chips">
            {curioTemplates.length ? curioTemplates.map((template: any) => <span key={template.id}>{template.config?.curio_source_code} · {template.name}</span>) : <span>Modelos oficiais serão sincronizados pelo Admin</span>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>Gerações recentes</h2><p>A fila já recebe texto e arquivos. A etapa de IA depende do provedor de geração configurado no ambiente.</p></div></div>
          {jobs?.length ? <div className="form-stack">{jobs.map((job: any) => (
            <article className="mission-card" key={job.id}>
              <div className="flex space-between gap-8 wrap"><strong>{job.input?.title_hint || job.job_type}</strong><Badge tone={statusTone(job.status)}>{job.status}</Badge></div>
              <p>{job.input?.template_contract ? `Modelo ${job.input.template_contract}` : "Modelo Curió"}{job.input?.source_file_name ? ` • Fonte: ${job.input.source_file_name}` : ""}</p>
              <small className="muted">{dateTime(job.created_at)}</small>{job.error_message && <p>{job.error_message}</p>}
            </article>
          ))}</div> : <EmptyState title="Nenhuma geração registrada" description="Cole um texto ou anexe um arquivo acima para começar." />}
        </section>
      </>
    );
  }

  if (section === "conteudos") {
    const [{ data: subjects }, { data: contents }] = await Promise.all([
      supabase.from("subjects").select("id,name").eq("active", true).order("name"),
      supabase.from("contents").select("id,name,parent_id,subjects(name)").eq("active", true).order("name").limit(120),
    ]);

    return (
      <>
        <PageHeader {...copy} />
        <div className="stats-grid">
          <StatCard value={subjects?.length ?? 0} label="Matérias" />
          <StatCard value={contents?.length ?? 0} label="Conteúdos cadastrados" />
          <StatCard value="≠" label="Conteúdo não é habilidade" detail="Conceitos permanecem separados" />
          <StatCard value="28+" label="Habilidades padronizadas" detail="Taxonomia reutilizável" />
        </div>
        <section className="panel">
          {contents?.length ? <div className="grid-3">{contents.slice(0, 36).map((content: any) => (
            <article className="mission-card" key={content.id}><Badge tone="blue">{content.subjects?.name || "Matéria"}</Badge><h3>{content.name}</h3><small className="muted">{content.parent_id ? "Subconteúdo" : "Conteúdo"}</small></article>
          ))}</div> : <EmptyState title="Nenhum conteúdo cadastrado" description="O catálogo pedagógico aparecerá aqui." />}
        </section>
      </>
    );
  }

  if (section === "avaliacoes") {
    const { data: assessments } = await supabase.from("assessments").select("id,title,instructions,scheduled_for,status,subjects(name),grades(name)").eq("created_by_teacher_id", teacher.id).order("scheduled_for", { ascending: false }).limit(40);
    return (<>
      <PageHeader {...copy} />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}{query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
      <section className="panel">{assessments?.length ? <div className="form-stack">{assessments.map((assessment: any) => (
        <article className="mission-card" key={assessment.id}>
          <div className="flex space-between gap-8 wrap"><div><strong>{assessment.title}</strong><p>{assessment.subjects?.name || "Avaliação"} • {assessment.grades?.name || "Série"}</p></div><Badge tone={statusTone(assessment.status)}>{assessment.status}</Badge></div>
          <small className="muted">{assessment.scheduled_for ? dateTime(assessment.scheduled_for) : "Sem data definida"}</small>
          <details className="plan-editor"><summary>Editar avaliação</summary><form action={updateTeacherResource} className="form-stack plan-form"><input type="hidden" name="kind" value="assessment"/><input type="hidden" name="id" value={assessment.id}/><div className="field"><label>Título</label><input className="input" name="title" defaultValue={assessment.title} required/></div><div className="field"><label>Instruções</label><textarea className="textarea" name="description" defaultValue={assessment.instructions || ""}/></div><button className="button button-secondary button-small" type="submit">Salvar alterações</button></form></details>
          <div className="plan-admin-actions">{assessment.status !== "archived" ? <form action={setTeacherResourceStatus}><input type="hidden" name="kind" value="assessment"/><input type="hidden" name="id" value={assessment.id}/><input type="hidden" name="status" value="archived"/><button className="button button-ghost button-small" type="submit">Arquivar</button></form> : <form action={setTeacherResourceStatus}><input type="hidden" name="kind" value="assessment"/><input type="hidden" name="id" value={assessment.id}/><input type="hidden" name="status" value="draft"/><button className="button button-secondary button-small" type="submit">Voltar a rascunho</button></form>}<form action={removeTeacherResource}><input type="hidden" name="kind" value="assessment"/><input type="hidden" name="id" value={assessment.id}/><button className="button button-danger button-small" type="submit">Excluir</button></form></div>
        </article>
      ))}</div> : <EmptyState title="Nenhuma avaliação criada" description="Avaliações podem alimentar o mesmo mapa pedagógico por questão e habilidade." />}</section>
    </>);
  }

  if (section === "mensagens") {
    const [{ data: threads }, { data: sentMessages }] = await Promise.all([
      supabase.from("message_thread_participants").select("thread_id,last_read_at,message_threads(id,subject,thread_type,updated_at)").eq("user_id", viewer.user.id).limit(30),
      supabase.from("messages").select("id,thread_id,body,created_at,edited_at,deleted_at,message_threads(subject)").eq("sender_user_id", viewer.user.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(30),
    ]);
    return (<>
      <PageHeader {...copy} />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}{query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
      <div className="grid-2">
        <section className="panel"><div className="panel-head"><div><h2>Conversas</h2><p>Organização por assunto e participantes.</p></div></div>{threads?.length ? <div className="form-stack">{threads.map((item: any) => <article className="mission-card" key={item.thread_id}><strong>{item.message_threads?.subject || "Conversa CURIÓ"}</strong><p>{item.message_threads?.thread_type || "Mensagem"}</p><small className="muted">Atualizada em {dateTime(item.message_threads?.updated_at)}</small></article>)}</div> : <EmptyState title="Nenhuma conversa" description="Mensagens com famílias e equipe aparecerão aqui." />}</section>
        <section className="panel"><div className="panel-head"><div><h2>Mensagens que você enviou</h2><p>Se mandar algo por engano, edite ou remova. A remoção preserva o registro operacional.</p></div></div>{sentMessages?.length ? <div className="form-stack">{sentMessages.map((message: any) => <article className="mission-card" key={message.id}><strong>{message.message_threads?.subject || "Conversa"}</strong><p>{message.body}</p><small className="muted">{dateTime(message.created_at)}{message.edited_at ? " • editada" : ""}</small><details className="plan-editor"><summary>Editar mensagem</summary><form action={editTeamMessage} className="form-stack plan-form"><input type="hidden" name="messageId" value={message.id}/><input type="hidden" name="returnPath" value="/professor/mensagens"/><textarea className="textarea" name="body" defaultValue={message.body} required/><button className="button button-secondary button-small" type="submit">Salvar edição</button></form></details><form action={removeTeamMessage}><input type="hidden" name="messageId" value={message.id}/><input type="hidden" name="returnPath" value="/professor/mensagens"/><button className="button button-danger button-small" type="submit">Remover mensagem</button></form></article>)}</div> : <EmptyState title="Nenhuma mensagem enviada" description="As mensagens enviadas por você aparecerão aqui." />}</section>
      </div>
    </>);
  }

  if (section === "relatorios") {
    const { data: reports } = await supabase
      .from("generated_reports")
      .select("id,student_id,report_type,period_start,period_end,created_at,students(preferred_name,full_name)")
      .eq("generated_by_user_id", viewer.user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    return (
      <>
        <PageHeader {...copy} />
        <section className="panel family-highlight"><strong>Relatório é saída, não fonte.</strong><p className="mb-0">O diagnóstico continua armazenado em conteúdo, habilidade, evidência, domínio, autonomia, confiança e histórico.</p></section>
        <section className="panel">
          {reports?.length ? <div className="form-stack">{reports.map((report: any) => (
            <article className="mission-card" key={report.id}><strong>{report.report_type}</strong><p>{report.students?.preferred_name || report.students?.full_name || "Aluno"}</p><small className="muted">{report.period_start || "—"} → {report.period_end || "—"} • gerado em {dateTime(report.created_at)}</small></article>
          ))}</div> : <EmptyState title="Nenhum relatório gerado" description="Quando necessário, gere relatórios a partir do mapa estruturado." />}
        </section>
      </>
    );
  }


  if (section === "suporte") {
    const { data: tickets } = await supabase.from("support_tickets").select("id,subject,description,category,priority,status,created_at,updated_at").eq("opened_by_user_id", viewer.user.id).order("updated_at", { ascending: false }).limit(40);
    return <><PageHeader {...copy} /><div className="grid-2"><section className="panel"><div className="panel-head"><div><h2>Abrir solicitação</h2><p>Para dúvidas da plataforma, conta, financeiro ou apoio pedagógico.</p></div></div><form action={createSupportTicket} className="form-stack"><input type="hidden" name="returnPath" value="/professor/suporte"/><div className="field"><label>Assunto</label><input className="input" name="subject" required/></div><div className="form-row"><div className="field"><label>Categoria</label><select className="select" name="category" defaultValue="platform"><option value="platform">Plataforma</option><option value="pedagogical">Pedagógico</option><option value="financial">Financeiro</option><option value="account">Conta e acesso</option><option value="other">Outro</option></select></div><div className="field"><label>Prioridade</label><select className="select" name="priority" defaultValue="normal"><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></div></div><div className="field"><label>Descrição</label><textarea className="textarea" name="description" required/></div><button className="button button-primary" type="submit">Enviar solicitação</button></form></section><section className="panel"><div className="panel-head"><div><h2>Meus tickets</h2><p>Acompanhe o status sem precisar repetir a solicitação.</p></div></div>{tickets?.length?<div className="form-stack">{tickets.map((t:any)=><article className="ticket-card" key={t.id}><div className="flex space-between gap-8 wrap"><strong>{t.subject}</strong><Badge tone={t.status==="resolved"||t.status==="closed"?"green":"yellow"}>{t.status}</Badge></div><p>{t.description}</p><small className="muted">{t.category} • {dateTime(t.updated_at)}</small></article>)}</div>:<EmptyState title="Nenhuma solicitação" description="Se precisar, abra um ticket pelo formulário ao lado."/>}</section></div></>;
  }

  if (section === "perfil") {
    const [{ data: profile }, { data: teacherProfile }, { data: specialties }, { data: teacherSubjects }] = await Promise.all([
      supabase.from("profiles").select("full_name,preferred_name,phone_whatsapp").eq("id", viewer.user.id).maybeSingle(),
      supabase.from("teachers").select("phone_whatsapp,professional_description").eq("id", teacher.id).maybeSingle(),
      supabase.from("teacher_specialties").select("teacher_specialty_catalog(name)").eq("teacher_id", teacher.id),
      supabase.from("teacher_subjects").select("subjects(name)").eq("teacher_id", teacher.id),
    ]);

    return (
      <>
        <PageHeader {...copy} />
        <section className="panel">
          <div className="form-row">
            <div className="field"><label>Nome completo</label><div className="input profile-readonly">{profile?.full_name || "Não informado"}</div></div>
            <div className="field"><label>E-mail</label><div className="input profile-readonly">{viewer.user.email || "Não informado"}</div><small className="muted">E-mail e papel não são editáveis por aqui.</small></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Telefone / WhatsApp</label><div className="input profile-readonly">{teacherProfile?.phone_whatsapp || profile?.phone_whatsapp || "Não informado"}</div></div>
            <div className="field"><label>Descrição profissional</label><div className="input profile-readonly">{teacherProfile?.professional_description || "Ainda não preenchida"}</div></div>
          </div>
        </section>
        <div className="grid-2">
          <section className="panel"><h2 className="mt-0">Especialidades</h2><div className="flex gap-8 wrap">{specialties?.length ? specialties.map((item: any, index: number) => <Badge tone="pink" key={index}>{item.teacher_specialty_catalog?.name}</Badge>) : <span className="muted">Nenhuma especialidade selecionada.</span>}</div></section>
          <section className="panel"><h2 className="mt-0">Matérias que acompanha</h2><div className="flex gap-8 wrap">{teacherSubjects?.length ? teacherSubjects.map((item: any, index: number) => <Badge tone="blue" key={index}>{item.subjects?.name}</Badge>) : <span className="muted">Nenhuma matéria selecionada.</span>}</div></section>
        </div>
      </>
    );
  }

  notFound();
}
