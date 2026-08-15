import { Badge, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { addTeacherAvailabilitySlot, removeTeacherAvailabilitySlot, updateTeacherProfile, uploadTeacherAvatar } from "./actions";

const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Slot = { day: number; start: string; end: string };

function slots(value: unknown): Slot[] {
  return Array.isArray(value) ? value.filter((item: any) => item && Number.isInteger(item.day) && item.day >= 0 && item.day <= 6) : [];
}

export default async function TeacherProfilePage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) return null;

  const [
    { data: profile },
    { data: teacherDetails },
    { data: allSubjects },
    { data: subjectLinks },
    { data: specialties },
    { data: specialtyLinks },
    { data: availability },
    { count: studentsCount },
    { count: missionsCount },
    { count: correctionsCount },
    { count: upcomingCount },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name,preferred_name,phone_whatsapp,avatar_path").eq("id", viewer.user.id).maybeSingle(),
    supabase.from("teachers").select("phone_whatsapp,professional_description").eq("id", teacher.id).maybeSingle(),
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("teacher_subjects").select("subject_id").eq("teacher_id", teacher.id),
    supabase.from("teacher_specialty_catalog").select("id,name").eq("active", true).order("name"),
    supabase.from("teacher_specialties").select("specialty_id").eq("teacher_id", teacher.id),
    supabase.from("teacher_availability").select("weekly_slots,available_periods,notes").eq("teacher_id", teacher.id).maybeSingle(),
    supabase.from("teacher_students").select("student_id", { count: "exact", head: true }).eq("teacher_id", teacher.id).eq("active", true),
    supabase.from("missions").select("id", { count: "exact", head: true }).eq("created_by_teacher_id", teacher.id),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    supabase.from("agenda_events").select("id", { count: "exact", head: true }).eq("created_by_teacher_id", teacher.id).gte("starts_at", new Date().toISOString()).neq("status", "cancelled"),
  ]);

  const subjectSet = new Set((subjectLinks ?? []).map((item: any) => item.subject_id));
  const specialtySet = new Set((specialtyLinks ?? []).map((item: any) => item.specialty_id));
  const weeklySlots = slots(availability?.weekly_slots);
  const avatarUrl = profile?.avatar_path
    ? (await supabase.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 60 * 30)).data?.signedUrl || ""
    : "";
  const displayName = profile?.preferred_name || profile?.full_name || "Professor(a)";

  return (
    <>
      <PageHeader eyebrow="Professor • Conta" title="Meu perfil" description="Sua apresentação profissional, matérias, especialidades, foto e horários disponíveis." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel">
        <div className="teacher-profile-hero">
          <div className="teacher-profile-photo">{avatarUrl ? <img src={avatarUrl} alt={`Foto de ${displayName}`} /> : <span>{displayName.slice(0,1).toUpperCase()}</span>}</div>
          <div>
            <Badge tone="blue">Professor PLUMARELI</Badge>
            <h2>{displayName}</h2>
            <p>{teacherDetails?.professional_description || "Adicione uma descrição curta para apresentar seu trabalho."}</p>
            <form action={uploadTeacherAvatar} className="flex gap-8 wrap mt-12">
              <input className="input" type="file" name="avatar" accept="image/png,image/jpeg,image/webp" required />
              <button className="button button-secondary button-small" type="submit">Trocar foto</button>
            </form>
          </div>
        </div>
        <div className="teacher-profile-stats">
          <div className="teacher-profile-stat"><strong>{studentsCount ?? 0}</strong><span>Alunos</span></div>
          <div className="teacher-profile-stat"><strong>{upcomingCount ?? 0}</strong><span>Próximos encontros</span></div>
          <div className="teacher-profile-stat"><strong>{missionsCount ?? 0}</strong><span>Missões criadas</span></div>
          <div className="teacher-profile-stat"><strong>{correctionsCount ?? 0}</strong><span>Correções pendentes</span></div>
        </div>
      </section>

      <div className="teacher-section-grid mt-16">
        <section className="panel">
          <div className="panel-head"><div><h2>Dados profissionais</h2><p>Você pode atualizar seus próprios dados sem depender do Admin.</p></div></div>
          <form action={updateTeacherProfile} className="form-stack">
            <div className="form-row"><div className="field"><label>Nome completo *</label><input className="input" name="fullName" defaultValue={profile?.full_name || ""} required /></div><div className="field"><label>Como prefere ser chamado</label><input className="input" name="preferredName" defaultValue={profile?.preferred_name || ""} /></div></div>
            <div className="field"><label>E-mail</label><input className="input" value={viewer.user.email || ""} readOnly /></div>
            <div className="field"><label>Telefone / WhatsApp</label><input className="input" name="phone" defaultValue={teacherDetails?.phone_whatsapp || profile?.phone_whatsapp || ""} /></div>
            <div className="field"><label>Descrição profissional</label><textarea className="textarea" name="professionalDescription" defaultValue={teacherDetails?.professional_description || ""} /></div>

            <div className="field"><label>Matérias que acompanha</label><div className="choice-chip-grid">{(allSubjects ?? []).map((subject: any) => <label className="choice-chip" key={subject.id}><input type="checkbox" name="subjectIds" value={subject.id} defaultChecked={subjectSet.has(subject.id)} /><span>{subject.name}</span></label>)}</div></div>
            <div className="field"><label>Especialidades</label><div className="choice-chip-grid">{(specialties ?? []).map((specialty: any) => <label className="choice-chip" key={specialty.id}><input type="checkbox" name="specialtyIds" value={specialty.id} defaultChecked={specialtySet.has(specialty.id)} /><span>{specialty.name}</span></label>)}</div></div>
            <button className="button button-primary" type="submit">Salvar perfil</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>Disponibilidade semanal</h2><p>Adicione quantos intervalos precisar em cada dia. Esses horários poderão ser usados pela operação para organizar encontros.</p></div></div>
          <div className="teacher-week-grid">
            {days.map((day, dayIndex) => {
              const daySlots = weeklySlots.filter((slot) => slot.day === dayIndex);
              return <div className="teacher-day-row" key={day}>
                <strong>{day}</strong>
                <div>
                  {daySlots.length ? <div className="teacher-slot-list">{daySlots.map((slot) => <form action={removeTeacherAvailabilitySlot} key={`${day}-${slot.start}-${slot.end}`}><input type="hidden" name="day" value={dayIndex}/><input type="hidden" name="start" value={slot.start}/><input type="hidden" name="end" value={slot.end}/><button className="teacher-slot-chip" type="submit" title="Clique para remover">{slot.start}–{slot.end} ×</button></form>)}</div> : <small className="muted">Sem horário cadastrado.</small>}
                  <form action={addTeacherAvailabilitySlot} className="teacher-slot-form">
                    <input type="hidden" name="day" value={dayIndex} />
                    <input className="input" type="time" name="start" aria-label={`Início em ${day}`} required />
                    <input className="input" type="time" name="end" aria-label={`Fim em ${day}`} required />
                    <button className="button button-secondary button-small" type="submit">Adicionar</button>
                  </form>
                </div>
              </div>;
            })}
          </div>
        </section>
      </div>
    </>
  );
}
