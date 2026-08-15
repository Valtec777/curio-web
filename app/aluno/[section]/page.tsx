import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { getCurrentStudent } from "@/lib/student";

const copy: Record<string, { eyebrow: string; title: string; description: string }> = {
  hoje: { eyebrow: "Explorador Plumareli", title: "Hoje", description: "Seu ponto de partida para as aventuras de hoje." },
  agenda: { eyebrow: "Explorador Plumareli", title: "Agenda", description: "Encontros e compromissos que fazem parte do seu caminho." },
  caminho: { eyebrow: "Explorador Plumareli", title: "Meu Caminho", description: "Veja o que já passou, o que está acontecendo e o que vem depois." },
  perfil: { eyebrow: "Explorador Plumareli", title: "Meu perfil", description: "Seu espaço no Plumareli." },
  caderno: { eyebrow: "Caderno Plumareli", title: "Meu Caderno", description: "Atividades fora da tela para escrever, pensar e mostrar seu raciocínio." },
  conquistas: { eyebrow: "Universo Plumareli", title: "Conquistas", description: "Cada conquista marca uma atitude importante na sua jornada." },
  descobertas: { eyebrow: "Universo Plumareli", title: "Descobertas", description: "Curiosidades e conteúdos que você desbloqueou pelo caminho." },
  "modo-pensar": { eyebrow: "Cursos Livres Plumareli", title: "Modo Pensar", description: "Cursos livres criados pela Administração, com trilhas curtas, progresso e certificado de conclusão." },
  "modo-prova": { eyebrow: "Preparação", title: "Modo Prova", description: "Revisão especial dos conteúdos e habilidades antes das avaliações." },
};

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function learnerLabel(level: number, evidenceCount = 0) {
  if (evidenceCount < 2) return "Nova habilidade";
  if (level >= 4) return "Consolidado";
  if (level >= 3) return "Praticando com autonomia";
  return "Em desenvolvimento";
}

export default async function StudentSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { section } = await params;
  const query = await searchParams;
  if (section === "hoje") redirect("/aluno");
  const sectionCopy = copy[section];
  if (!sectionCopy) notFound();

  const { student, supabase } = await getCurrentStudent();
  if (!student) return <EmptyState title="Seu perfil de aluno ainda está sendo preparado" description="Quando a administração concluir o vínculo, seu espaço será liberado." />;

  if (section === "agenda") {
    const { data: events } = await supabase
      .from("agenda_event_students")
      .select("event_id,agenda_events(id,title,description,event_type,starts_at,ends_at,status,meeting_url,location,visible_to_student)")
      .eq("student_id", student.id)
      .limit(40);
    const visible = (events ?? []).map((item: any) => item.agenda_events).filter((event: any) => event?.visible_to_student && new Date(event.starts_at) >= new Date()).sort((a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at));
    return <><PageHeader {...sectionCopy} /><section className="panel">{visible.length ? <div className="form-stack">{visible.map((event: any) => <article className="mission-card" key={event.id}><div className="flex space-between gap-8 wrap"><div><strong>{event.title}</strong><p>{event.description || event.event_type}</p></div><Badge tone="blue">{dateTime(event.starts_at)}</Badge></div>{event.location && <small className="muted">{event.location}</small>}{event.meeting_url && <p className="mb-0"><a href={event.meeting_url}>Entrar no encontro →</a></p>}</article>)}</div> : <EmptyState title="Sua agenda está livre" description="Quando houver um encontro, ele aparecerá aqui." />}</section></>;
  }

  if (section === "caminho") {
    const { data: items } = await supabase.from("learning_path_items").select("id,item_type,title,position,status,available_at,due_at,completed_at").eq("student_id", student.id).order("position");
    const completed = (items ?? []).filter((item: any) => item.status === "completed").length;
    return <><PageHeader {...sectionCopy} /><div className="stats-grid"><StatCard value={completed} label="Etapas concluídas" /><StatCard value={(items?.length ?? 0) - completed} label="Próximas etapas" /><StatCard value={items?.length ?? 0} label="Total no caminho" /><StatCard value="★" label="Um passo de cada vez" /></div><section className="panel">{items?.length ? <div className="path-list">{items.map((item: any) => <article className={`path-item path-${item.status}`} key={item.id}><span className="path-position">{item.position}</span><div><small>{item.item_type}</small><h3>{item.title}</h3><p>{item.status === "completed" ? "Concluído" : item.status === "available" ? "Disponível agora" : "Próximo desafio"}</p></div><Badge tone={item.status === "completed" ? "green" : item.status === "available" ? "yellow" : "neutral"}>{item.status}</Badge></article>)}</div> : <EmptyState title="Seu caminho está sendo montado" description="As próximas etapas aparecerão conforme suas missões forem organizadas." />}</section></>;
  }

  if (section === "perfil") {
    const [{ data: details }, { data: game }, { data: states }] = await Promise.all([
      supabase.from("students").select("preferred_name,full_name,school_name,grades(name)").eq("id", student.id).maybeSingle(),
      supabase.from("student_game_profiles").select("stars,streak_days,level_name,last_activity_date").eq("student_id", student.id).maybeSingle(),
      supabase.from("student_skill_states").select("domain_level,evidence_count,skills(name)").eq("student_id", student.id).order("updated_at", { ascending: false }).limit(6),
    ]);
    return <><PageHeader {...sectionCopy} /><div className="grid-2"><section className="panel"><h2 className="mt-0">Sobre mim</h2><div className="profile-lines"><div><span>Nome</span><strong>{details?.preferred_name || details?.full_name}</strong></div><div><span>Ano</span><strong>{(details as any)?.grades?.name || "—"}</strong></div><div><span>Escola</span><strong>{details?.school_name || "Não informada"}</strong></div></div></section><section className="panel"><h2 className="mt-0">Minha jornada</h2><div className="profile-lines"><div><span>Nível</span><strong>{game?.level_name || "Explorador Plumareli"}</strong></div><div><span>Estrelas</span><strong>{game?.stars ?? 0} ★</strong></div><div><span>Sequência</span><strong>{game?.streak_days ?? 0} dia(s)</strong></div></div></section></div><section className="panel"><h2 className="mt-0">Habilidades que estou praticando</h2>{states?.length ? <div className="grid-3">{states.map((state: any, i: number) => <article className="mission-card" key={i}><strong>{state.skills?.name}</strong><p>{learnerLabel(state.domain_level, state.evidence_count)}</p></article>)}</div> : <p className="muted">Seu mapa começa a aparecer depois das primeiras atividades corrigidas.</p>}</section></>;
  }

  if (section === "caderno") {
    const { data: assignments } = await supabase.from("notebook_assignments").select("id,status,due_at,submitted_at,submission_photo_path,teacher_note,stars_awarded,notebook_activities(title,description,worksheet_path,subjects(name))").eq("student_id", student.id).order("submitted_at", { ascending: false, nullsFirst: false }).limit(40);
    return <><PageHeader {...sectionCopy} /><section className="panel family-highlight"><strong>Escrever também é aprender.</strong><p className="mb-0">As atividades do Caderno Plumareli ficam fora do quiz: abra a folha/PDF, faça no caderno ou impresso, fotografe quando solicitado e envie para a professora revisar.</p></section><section className="panel">{assignments?.length ? <div className="form-stack">{assignments.map((item: any) => <article className="mission-card" key={item.id}><div className="flex space-between gap-8 wrap"><div><Badge tone="blue">{item.notebook_activities?.subjects?.name || "Caderno Plumareli"}</Badge><h3>{item.notebook_activities?.title}</h3><p>{item.notebook_activities?.description}</p></div><Badge tone={item.status === "completed" ? "green" : item.status === "submitted" ? "yellow" : "neutral"}>{item.status}</Badge></div><div className="flex gap-8 wrap">{item.notebook_activities?.worksheet_path && <a className="button button-secondary button-small" href={item.notebook_activities.worksheet_path} target="_blank" rel="noreferrer">Abrir atividade / PDF ↗</a>}{item.submission_photo_path && <Badge tone="green">Foto enviada</Badge>}{item.stars_awarded > 0 && <Badge tone="yellow">+{item.stars_awarded} ★</Badge>}</div>{item.teacher_note && <div className="notice">Recado da professora: {item.teacher_note}</div>}</article>)}</div> : <EmptyState title="Nenhuma atividade de caderno agora" description="As próximas atividades aparecem aqui quando forem enviadas." />}</section></>;
  }

  if (section === "conquistas") {
    const { data: achievements } = await supabase.from("student_achievements").select("achievement_id,earned_at,achievements(name,description,icon,color_key)").eq("student_id", student.id).order("earned_at", { ascending: false });
    return <><PageHeader {...sectionCopy} /><section className="panel">{achievements?.length ? <div className="grid-3">{achievements.map((item: any) => <article className="achievement-card" key={item.achievement_id}><div className="achievement-icon">{item.achievements?.icon || "★"}</div><h3>{item.achievements?.name}</h3><p>{item.achievements?.description}</p><small>Conquistada em {dateTime(item.earned_at)}</small></article>)}</div> : <EmptyState title="Suas conquistas estão esperando por você" description="Continue praticando. As primeiras vão aparecer aqui." />}</section></>;
  }

  if (section === "descobertas") {
    const { data: discoveries } = await supabase.from("student_discoveries").select("discovery_id,unlocked_at,viewed_at,discoveries(title,body,image_path,subjects(name))").eq("student_id", student.id).order("unlocked_at", { ascending: false });
    return <><PageHeader {...sectionCopy} /><section className="panel">{discoveries?.length ? <div className="grid-3">{discoveries.map((item: any) => <article className="mission-card" key={item.discovery_id}><Badge tone="green">{item.discoveries?.subjects?.name || "Descoberta"}</Badge><h3>{item.discoveries?.title}</h3><p>{item.discoveries?.body}</p><small className="muted">Desbloqueada em {dateTime(item.unlocked_at)}</small></article>)}</div> : <EmptyState title="Nenhuma descoberta desbloqueada ainda" description="As descobertas aparecem conforme você avança pelas missões." />}</section></>;
  }

  if (section === "modo-pensar") {
    const [{ data: courses }, { data: enrollments }, { data: certificates }] = await Promise.all([
      supabase.from("free_courses").select("id,title,summary,description,audience_label,estimated_minutes,certificate_enabled,published_at").eq("status", "published").order("published_at", { ascending: false, nullsFirst: false }),
      supabase.from("free_course_enrollments").select("course_id,status,progress_percent,completed_at").eq("student_id", student.id),
      supabase.from("free_course_certificates").select("course_id,certificate_code,issued_at").eq("student_id", student.id),
    ]);
    const enrollmentByCourse = new Map((enrollments ?? []).map((item: any) => [item.course_id, item]));
    const certificateByCourse = new Map((certificates ?? []).map((item: any) => [item.course_id, item]));
    return <>
      <PageHeader {...sectionCopy} />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
      <section className="thinking-hero course-thinking-hero"><div><span aria-hidden="true">✦</span><h2>Aprenda algo novo além da escola.</h2><p>O Modo Pensar agora reúne cursos livres do Plumareli. A Administração publica os cursos, você avança no seu ritmo e, quando concluir uma trilha certificável, recebe um certificado.</p></div></section>
      <section className="panel course-library-panel">
        <div className="panel-head"><div><h2>Cursos disponíveis</h2><p>Cursos livres não substituem a escola nem as Missões Cuca: são trilhas extras para ampliar repertório, autonomia e curiosidade.</p></div></div>
        {courses?.length ? <div className="course-grid">{courses.map((course: any) => {
          const enrollment: any = enrollmentByCourse.get(course.id);
          const certificate: any = certificateByCourse.get(course.id);
          return <article className="course-card" key={course.id}>
            <div className="course-card-top"><Badge tone={certificate ? "green" : enrollment ? "blue" : "purple"}>{certificate ? "Certificado liberado" : enrollment ? `${enrollment.progress_percent}% concluído` : "Curso livre"}</Badge><span>{course.estimated_minutes} min</span></div>
            <h3>{course.title}</h3><p>{course.summary || course.description || "Uma trilha livre do Universo Plumareli."}</p>
            <div className="course-card-meta"><span>{course.audience_label || "Para mentes curiosas"}</span>{course.certificate_enabled && <span>Certificado ✓</span>}</div>
            <Link className="button button-primary button-small" href={`/aluno/cursos/${course.id}`}>{certificate ? "Ver curso e certificado" : enrollment ? "Continuar curso" : "Conhecer curso"}</Link>
          </article>;
        })}</div> : <EmptyState title="Novos cursos estão sendo preparados" description="Quando a Administração publicar um curso livre, ele aparecerá aqui." />}
      </section>
    </>;
  }

  if (section === "modo-prova") {
    const { data: assessments } = await supabase.from("assessment_students").select("id,status,score,started_at,submitted_at,reviewed_at,assessments(id,title,instructions,scheduled_for,subjects(name))").eq("student_id", student.id).order("submitted_at", { ascending: false, nullsFirst: false }).limit(30);
    return <><PageHeader {...sectionCopy} /><section className="panel family-highlight"><strong>Revisar não é decorar tudo de novo.</strong><p className="mb-0">O Modo Prova prioriza conteúdos atuais e habilidades que merecem mais prática.</p></section><section className="panel">{assessments?.length ? <div className="form-stack">{assessments.map((item: any) => <article className="mission-card" key={item.id}><div className="flex space-between gap-8 wrap"><div><Badge tone="blue">{item.assessments?.subjects?.name || "Avaliação"}</Badge><h3>{item.assessments?.title}</h3><p>{item.assessments?.instructions || "Revisão orientada pelo Plumareli."}</p></div><Badge tone={item.status === "reviewed" ? "green" : "yellow"}>{item.status}</Badge></div><small className="muted">{item.assessments?.scheduled_for ? `Avaliação: ${dateTime(item.assessments.scheduled_for)}` : "Data a definir"}</small></article>)}</div> : <EmptyState title="Nenhuma avaliação próxima" description="Quando houver uma avaliação vinculada, sua preparação aparecerá aqui." />}</section></>;
  }

  notFound();
}
