"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type StudentMascotMomentProps = {
  name: string;
  stars: number;
  streakDays: number;
  pendingMissions: number;
};

const messages = [
  "Leia a pergunta uma vez para entender e outra para procurar as pistas importantes.",
  "Quando travar, explique com suas palavras o que você já entendeu. Isso ajuda o cérebro a organizar o próximo passo.",
  "Não precisa acertar de primeira. Tente, confira o que mudou e faça uma segunda tentativa mais esperta.",
  "Se a atividade parecer grande, divida em partes pequenas e resolva uma de cada vez.",
  "Antes de terminar, pergunte a si mesmo: eu consigo explicar por que essa resposta faz sentido?",
];

export function StudentMascotMoment({ name, stars, streakDays, pendingMissions }: StudentMascotMomentProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const encouragement = useMemo(() => {
    if (streakDays >= 5) return `${streakDays} dias seguidos! Consistência também é uma conquista.`;
    if (stars >= 20) return `Você já juntou ${stars} estrelas. Cada uma conta uma parte do que você praticou.`;
    if (pendingMissions === 0) return "Tudo em dia por aqui. Que tal explorar uma descoberta nova?";
    return `${pendingMissions} ${pendingMissions === 1 ? "missão está" : "missões estão"} esperando por você. Escolha uma e comece sem pressa.`;
  }, [pendingMissions, stars, streakDays]);

  function nextTip() {
    setTipIndex((current) => (current + 1) % messages.length);
  }

  return (
    <section className="student-mascot-moment" aria-labelledby="mascot-moment-title">
      <div className="student-mascot-moment-character" aria-hidden="true">
        <Image
          src="/mascotes/plumareli_mico_leao_dourado_principal.webp"
          alt=""
          width={180}
          height={180}
        />
      </div>
      <div className="student-mascot-moment-copy">
        <span className="eyebrow">Momento Plumareli</span>
        <h2 id="mascot-moment-title">Ei, {name}. Quer uma pista para estudar melhor?</h2>
        <p className="student-mascot-encouragement">{encouragement}</p>
        <div className="student-mascot-speech" aria-live="polite">{messages[tipIndex]}</div>
        <div className="student-mascot-actions">
          <button className="button button-secondary" type="button" onClick={nextTip}>Outra dica</button>
          <Link className="button button-primary" href="/aluno/missoes">Escolher uma missão</Link>
        </div>
      </div>
    </section>
  );
}
