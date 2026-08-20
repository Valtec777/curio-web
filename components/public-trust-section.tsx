import styles from "./public-trust-section.module.css";
import conversionStyles from "./landing-conversion.module.css";

export function PublicTrustSection() {
  const trustItems = [
    ["Primeiro contato simples", "Nesta etapa pedimos apenas nome do responsável, WhatsApp, e-mail e ano escolar. Os detalhes do aluno ficam para a matrícula, se a família decidir seguir."],
    ["Acompanhamento humano", "A tecnologia ajuda a organizar a rotina, mas o acompanhamento continua sendo feito por pessoas."],
    ["Família acompanha o percurso", "Progresso, agenda, atividades e próximos passos ficam reunidos em um espaço próprio para a família."],
    ["Aprendizagem além da tela", "O Caderno Plumareli mantém escrita, raciocínio e produção manual como parte do percurso."],
  ] as const;

  return (
    <section className={`section ${styles.section} ${conversionStyles.scope}`} aria-labelledby="public-trust-title">
      <div className="site-shell">
        <div className={styles.intro}>
          <div>
            <div className="eyebrow eyebrow-blue">Antes de decidir</div>
            <h2 id="public-trust-title">Entenda como o acompanhamento entra na rotina da sua família.</h2>
          </div>
          <p>
            O primeiro contato serve para conhecer o momento do aluno, esclarecer como o Plumareli funciona e organizar o próximo passo com mais clareza.
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
          <div>
            <strong>Quer entender se o Plumareli combina com a rotina do aluno?</strong>
            <span>Comece pelo contato inicial. Você informa só o essencial e a equipe explica o acompanhamento antes da etapa de matrícula.</span>
          </div>
          <a className="button button-primary" href="#quero-conhecer">Quero conhecer o Plumareli</a>
        </div>
      </div>
    </section>
  );
}
