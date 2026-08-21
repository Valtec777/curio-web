import styles from "./public-trust-section.module.css";
import conversionStyles from "./landing-conversion.module.css";

const trustItems = [
  ["Primeiro contato simples", "Nesta etapa pedimos apenas nome do responsável, WhatsApp, e-mail e ano escolar. Os detalhes do aluno ficam para a matrícula, se a família decidir seguir."],
  ["Acompanhamento humano", "A tecnologia ajuda a organizar a rotina, mas o acompanhamento continua sendo feito por pessoas."],
  ["Família acompanha o percurso", "Progresso, agenda, atividades e próximos passos ficam reunidos em um espaço próprio para a família."],
  ["Aprendizagem além da tela", "O Caderno Plumareli mantém escrita, raciocínio e produção manual como parte do percurso."],
] as const;

function StudentPreview() {
  return (
    <article className={`${styles.productCard} ${styles.studentCard}`} aria-label="Prévia ilustrativa do Portal do Aluno">
      <div className={styles.productHead}>
        <div>
          <span>Portal do Aluno</span>
          <strong>Suas missões de hoje</strong>
        </div>
        <b className={styles.starPill}>★ 28</b>
      </div>
      <div className={styles.missionPreview}>
        <div className={styles.missionMeta}><span>Matemática</span><b>Em andamento</b></div>
        <strong>Frações no dia a dia</strong>
        <small>Resolva situações usando diferentes representações.</small>
        <div className={styles.progressTrack}><span /></div>
      </div>
      <div className={styles.missionPreview}>
        <div className={styles.missionMeta}><span>Língua Portuguesa</span><b>Começar</b></div>
        <strong>Ideia principal do texto</strong>
        <small>Leia, pense e explique com suas palavras.</small>
      </div>
      <div className={styles.notebookPreview}><span>Meu Caderno</span><strong>1 atividade para fazer à mão</strong></div>
    </article>
  );
}

function FamilyPreview() {
  return (
    <article className={styles.productCard} aria-label="Prévia ilustrativa do Ninho da Família">
      <div className={styles.productHead}>
        <div>
          <span>Ninho da Família</span>
          <strong>Acompanhando o percurso</strong>
        </div>
        <b className={styles.activePill}>Ativo</b>
      </div>
      <div className={styles.familyMetrics}>
        <div><strong>12</strong><span>Missões concluídas</span></div>
        <div><strong>2</strong><span>Pendentes</span></div>
        <div><strong>74%</strong><span>Progresso observado</span></div>
      </div>
      <div className={styles.familyList}>
        <div><i className={styles.blueDot} /><span><small>Próximo encontro</small><strong>Matemática · terça, 16h</strong></span></div>
        <div><i className={styles.pinkDot} /><span><small>Feedback recente</small><strong>Boa evolução na resolução de problemas.</strong></span></div>
      </div>
    </article>
  );
}

function ProgressPreview() {
  return (
    <article className={styles.productCard} aria-label="Prévia ilustrativa do acompanhamento de progresso">
      <div className={styles.productHead}>
        <div>
          <span>Meu Caminho</span>
          <strong>O que está evoluindo</strong>
        </div>
        <b className={styles.softPill}>Evidências</b>
      </div>
      <div className={styles.skillList}>
        <div className={styles.skillRow}>
          <span><strong>Resolução de problemas</strong><small>Domínio observado</small></span>
          <div className={styles.skillMeter}><i /><i /><i /><em /></div>
          <b className={styles.goodTrend}>Melhorando</b>
        </div>
        <div className={styles.skillRow}>
          <span><strong>Leitura e interpretação</strong><small>Domínio observado</small></span>
          <div className={styles.skillMeter}><i /><i /><i /><em /></div>
          <b className={styles.stableTrend}>Estável</b>
        </div>
        <div className={styles.skillRow}>
          <span><strong>Organização dos estudos</strong><small>Em desenvolvimento</small></span>
          <div className={styles.skillMeter}><i /><i /><em /><em /></div>
          <b className={styles.attentionTrend}>Atenção</b>
        </div>
      </div>
      <p className={styles.productFootnote}>A evolução é acompanhada ao longo do percurso, com contexto e evidências das atividades.</p>
    </article>
  );
}

export function PublicTrustSection() {
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

        <div className={styles.productIntro}>
          <div>
            <span className={styles.productEyebrow}>Por dentro do Plumareli</span>
            <h3>Veja como aluno, família e acompanhamento se conectam.</h3>
          </div>
          <p>As prévias abaixo reproduzem a lógica das telas reais do produto com dados ilustrativos, sem expor informações de alunos.</p>
        </div>

        <div className={styles.productGrid}>
          <StudentPreview />
          <FamilyPreview />
          <ProgressPreview />
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
