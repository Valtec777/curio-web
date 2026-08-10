import Image from "next/image";
import { Badge, PageHeader } from "@/components/ui";
import { getCurrentStudent } from "@/lib/student";
import { chooseStudentAvatar } from "./actions";
import { AvatarSubmitButton } from "./avatar-submit-button";

function learnerLabel(level: number, evidenceCount = 0) {
  if (evidenceCount < 2) return "Nova habilidade";
  if (level >= 4) return "Consolidado";
  if (level >= 3) return "Praticando com autonomia";
  return "Em desenvolvimento";
}

export default async function StudentProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const { student, supabase } = await getCurrentStudent();

  const [{ data: details }, { data: game }, { data: states }, { data: characters }] = await Promise.all([
    supabase
      .from("students")
      .select("preferred_name,full_name,school_name,grades(name)")
      .eq("id", student.id)
      .maybeSingle(),
    supabase
      .from("student_game_profiles")
      .select("stars,streak_days,level_name,last_activity_date,avatar_character_id")
      .eq("student_id", student.id)
      .maybeSingle(),
    supabase
      .from("student_skill_states")
      .select("domain_level,evidence_count,skills(name)")
      .eq("student_id", student.id)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("characters")
      .select("id,name,assets")
      .eq("active", true)
      .order("name"),
  ]);

  const avatars = (characters ?? []).filter((character: any) => Boolean(character.assets?.avatar));
  const selectedAvatar = avatars.find((character: any) => character.id === game?.avatar_character_id) || null;

  return (
    <>
      <PageHeader
        eyebrow="Explorador Curió"
        title="Meu perfil"
        description="Seu espaço no Curió. Escolha um mascote e acompanhe sua jornada."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="grid-2">
        <section className="panel">
          <h2 className="mt-0">Sobre mim</h2>
          <div className="profile-lines">
            <div><span>Nome</span><strong>{details?.preferred_name || details?.full_name}</strong></div>
            <div><span>Ano</span><strong>{(details as any)?.grades?.name || "—"}</strong></div>
            <div><span>Escola</span><strong>{details?.school_name || "Não informada"}</strong></div>
          </div>
        </section>

        <section className="panel">
          <div className="flex gap-16 align-center wrap">
            {selectedAvatar ? (
              <Image
                src={selectedAvatar.assets.avatar}
                alt={`Avatar ${selectedAvatar.name}`}
                width={112}
                height={112}
              />
            ) : (
              <div className="achievement-icon" aria-hidden="true">★</div>
            )}
            <div>
              <h2 className="mt-0">Minha jornada</h2>
              <div className="profile-lines">
                <div><span>Nível</span><strong>{game?.level_name || "Explorador Curió"}</strong></div>
                <div><span>Estrelas</span><strong>{game?.stars ?? 0} ★</strong></div>
                <div><span>Sequência</span><strong>{game?.streak_days ?? 0} dia(s)</strong></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Escolha seu avatar</h2>
            <p>A escolha fica salva neste aluno. Usamos apenas os mascotes que já fazem parte do CURIÓ.</p>
          </div>
          {selectedAvatar && <Badge tone="green">Atual: {selectedAvatar.name}</Badge>}
        </div>

        {avatars.length ? (
          <div className="grid-3">
            {avatars.map((character: any) => {
              const selected = character.id === game?.avatar_character_id;
              return (
                <article className="mission-card" key={character.id}>
                  <div className="flex space-between gap-8 align-center wrap">
                    <Image
                      src={character.assets.avatar}
                      alt={`Avatar ${character.name}`}
                      width={104}
                      height={104}
                    />
                    {selected && <Badge tone="green">Escolhido</Badge>}
                  </div>
                  <h3>{character.name}</h3>
                  <form action={chooseStudentAvatar}>
                    <input type="hidden" name="characterId" value={character.id} />
                    <AvatarSubmitButton selected={selected} />
                  </form>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">Os avatares do CURIÓ ainda não estão disponíveis.</p>
        )}
      </section>

      <section className="panel">
        <h2 className="mt-0">Habilidades que estou praticando</h2>
        {states?.length ? (
          <div className="grid-3">
            {states.map((state: any, index: number) => (
              <article className="mission-card" key={index}>
                <strong>{state.skills?.name}</strong>
                <p>{learnerLabel(state.domain_level, state.evidence_count)}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Seu mapa começa a aparecer depois das primeiras atividades corrigidas.</p>
        )}
      </section>
    </>
  );
}
