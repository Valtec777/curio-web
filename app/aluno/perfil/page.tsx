import Image from "next/image";
import { Badge, PageHeader } from "@/components/ui";
import { CurioIcon } from "@/components/nav-icon";
import { getCurrentStudent } from "@/lib/student";
import { chooseStudentAvatar } from "./actions";
import { AvatarSubmitButton } from "./avatar-submit-button";

function relation<T=any>(value:any):T|null{return (Array.isArray(value)?value[0]:value)||null;}
function learnerLabel(level: number, evidenceCount = 0) {
  if (evidenceCount < 2) return "Nova habilidade";
  if (level >= 4) return "Consolidado";
  if (level >= 3) return "Praticando com autonomia";
  return "Em desenvolvimento";
}

export default async function StudentProfilePage({searchParams}:{searchParams:Promise<{erro?:string;sucesso?:string}>}) {
  const query=await searchParams;
  const {student,supabase}=await getCurrentStudent();
  await supabase.rpc("refresh_student_achievements",{p_student_id:student.id});
  const [{data:details},{data:game},{data:states},{data:characters},{count:achievementCount}]=await Promise.all([
    supabase.from("students").select("preferred_name,full_name,school_name,grades(name)").eq("id",student.id).maybeSingle(),
    supabase.from("student_game_profiles").select("stars,streak_days,level_name,last_activity_date,avatar_character_id").eq("student_id",student.id).maybeSingle(),
    supabase.from("student_skill_states").select("domain_level,evidence_count,skills(name)").eq("student_id",student.id).order("updated_at",{ascending:false}).limit(6),
    supabase.from("characters").select("id,name,assets").eq("active",true).order("name"),
    supabase.from("student_achievements").select("achievement_id",{count:"exact",head:true}).eq("student_id",student.id),
  ]);
  const avatars=(characters??[]).filter((character:any)=>Boolean(character.assets?.avatar||character.assets?.principal));
  const selectedAvatar=avatars.find((character:any)=>character.id===game?.avatar_character_id)||null;
  const grade:any=relation((details as any)?.grades);

  return <>
    <PageHeader eyebrow="Explorador Curió" title="Meu perfil" description="Deixe o CURIÓ do seu jeito. Seu avatar acompanha você pelo portal e aparece para quem acompanha sua jornada."/>
    {query.erro&&<div className="form-message form-error">{query.erro}</div>}{query.sucesso&&<div className="form-message form-success">{query.sucesso}</div>}
    <section className="student-profile-hero panel"><div className="flex gap-16 align-center wrap">{selectedAvatar?<div className="student-profile-character-frame"><Image className="student-profile-character" src={selectedAvatar.assets.avatar||selectedAvatar.assets.principal} alt={`Avatar ${selectedAvatar.name}`} width={140} height={140}/></div>:<div className="achievement-icon"><CurioIcon name="star" /></div>}<div><span className="student-kicker">{game?.level_name||"Explorador Curió"}</span><h2>{details?.preferred_name||details?.full_name}</h2><p>{grade?.name||"Ano não informado"}{details?.school_name?` · ${details.school_name}`:""}</p><div className="flex gap-8 wrap"><Badge tone="yellow"><span className="badge-inline-icon"><CurioIcon name="star" /></span>{game?.stars??0} estrelas</Badge><Badge tone="pink"><span className="badge-inline-icon"><CurioIcon name="fire" /></span>{game?.streak_days??0} dias</Badge><Badge tone="purple"><span className="badge-inline-icon"><CurioIcon name="trophy" /></span>{achievementCount??0} conquistas</Badge></div></div></div></section>
    <section className="panel"><div className="panel-head"><div><h2>Escolha seu avatar</h2><p>Clique em um personagem. A escolha fica salva e passa a aparecer na sua lateral e para a equipe que acompanha você.</p></div>{selectedAvatar&&<Badge tone="green">Atual: {selectedAvatar.name}</Badge>}</div>{avatars.length?<div className="student-avatar-grid">{avatars.map((character:any)=>{const selected=character.id===game?.avatar_character_id;const src=character.assets.avatar||character.assets.principal;return <article className={`student-avatar-card${selected?" is-selected":""}`} key={character.id}><div className="student-avatar-image-frame"><Image className="student-avatar-image" src={src} alt={`Avatar ${character.name}`} width={132} height={132}/></div><h3>{character.name}</h3><form action={chooseStudentAvatar}><input type="hidden" name="characterId" value={character.id}/><AvatarSubmitButton selected={selected}/></form></article>;})}</div>:<p className="muted">Os avatares do CURIÓ ainda não estão disponíveis.</p>}</section>
    <section className="panel"><h2 className="mt-0">Habilidades que estou praticando</h2>{states?.length?<div className="grid-3">{states.map((state:any,index:number)=><article className="mission-card" key={index}><strong>{relation<any>(state.skills)?.name||"Habilidade"}</strong><p>{learnerLabel(state.domain_level,state.evidence_count)}</p></article>)}</div>:<p className="muted">Seu mapa começa a aparecer depois das primeiras atividades corrigidas.</p>}</section>
  </>;
}
