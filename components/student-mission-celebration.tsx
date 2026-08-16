import Image from "next/image";
import Link from "next/link";

export function StudentMissionCelebration({ message }: { message: string }) {
  return (
    <section className="student-mission-celebration" aria-live="polite">
      <div className="student-mission-celebration-character" aria-hidden="true">
        <Image
          src="/mascotes/plumareli_mico_leao_dourado_principal.webp"
          alt=""
          width={150}
          height={150}
        />
      </div>
      <div>
        <div className="eyebrow">Missão enviada</div>
        <h2>Você tentou, pensou e chegou até o fim.</h2>
        <p>{message}</p>
        <div className="flex gap-8 wrap mt-12">
          <Link className="button button-primary button-small" href="/aluno/caminho">Ver meu caminho</Link>
          <Link className="button button-secondary button-small" href="/aluno/conquistas">Minhas conquistas</Link>
        </div>
      </div>
    </section>
  );
}
