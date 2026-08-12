import styles from "./public-trust-section.module.css";

export function PublicTrustSection() {
  const trustItems = [
    ["Acompanhamento humano", "A tecnologia apoia a organização, mas o acompanhamento continua sendo feito por pessoas."],
    ["Evolução fácil de acompanhar", "A família acompanha progresso, agenda, atividades e próximos passos de forma clara."],
    ["Aprendizagem além da tela", "O Caderno Curió mantém escrita, raciocínio e produção manual como parte do percurso."],
    ["Cada perfil no seu espaço", "Aluno, família, professor e administração acessam áreas próprias para o que precisam fazer."],
  ] as const;

  return (
    <section className={`section ${styles.section}`} aria-labelledby="public-trust-title">
      <div className="site-shell">
        <div className={styles.intro}>
          <div>
            <div className="eyebrow eyebrow-blue">Clareza para quem acompanha</div>
            <h2 id="public-trust-title">Uma experiência acolhedora para a criança e organizada para a família.</h2>
          </div>
          <p>
            O Curió combina atividades, acompanhamento e uma experiência visual leve para que estudar faça mais sentido no dia a dia.
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
          <strong>Aprender continua sendo o centro.</strong>
          <span>A tecnologia apoia a rotina; a criança pensa, pratica, revisa e desenvolve autonomia com acompanhamento de verdade.</span>
        </div>
      </div>
    </section>
  );
}
