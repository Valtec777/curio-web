import styles from "./public-trust-section.module.css";

export function PublicTrustSection() {
  const trustItems = [
    ["Acompanhamento humano", "A tecnologia organiza informações e apoia a rotina, mas o acompanhamento continua sendo feito por pessoas."],
    ["Evolução que a família entende", "O responsável acompanha progresso, agenda, atividades e próximos passos sem depender apenas de notas."],
    ["Aprendizagem além da tela", "O Caderno Curió mantém escrita, raciocínio e produção manual como parte real do percurso."],
    ["Cada perfil no seu espaço", "Aluno, família, professor e administração acessam áreas próprias, pensadas para o que cada pessoa precisa fazer."],
  ] as const;

  return (
    <section className={`section ${styles.section}`} aria-labelledby="public-trust-title">
      <div className="site-shell">
        <div className={styles.intro}>
          <div>
            <div className="eyebrow eyebrow-blue">Para quem cuida, clareza importa</div>
            <h2 id="public-trust-title">Um acompanhamento divertido para a criança e sério para a família.</h2>
          </div>
          <p>
            O Curió foi pensado para estimular curiosidade sem transformar estudo em distração. A criança encontra missões, mascotes e conquistas; a família encontra rotina, contexto e acompanhamento objetivo.
          </p>
        </div>

        <div className={styles.grid}>
          {trustItems.map(([title, text], index) => (
            <article className={styles.card} key={title}>
              <span className={styles.number}>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>

        <div className={styles.note}>
          <strong>Sem atalhos mágicos.</strong>
          <span>O objetivo é ajudar a criança a entender, tentar, praticar, revisar e ganhar autonomia com acompanhamento de verdade.</span>
        </div>
      </div>
    </section>
  );
}
