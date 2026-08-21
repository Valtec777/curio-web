import styles from "./public-trust-section.module.css";

const trustItems = [
  ["Acompanhamento humano", "A tecnologia organiza a rotina, mas decisões pedagógicas e devolutivas continuam com pessoas."],
  ["Família sem adivinhação", "Agenda, pendências, progresso e feedback aparecem no mesmo espaço para facilitar o acompanhamento."],
  ["Aluno com próximo passo claro", "Missões, atividades do caderno e avaliações ficam organizadas para reduzir a sensação de estar perdido."],
] as const;

function FamilyPreview() {
  return (
    <article className={styles.previewCard} aria-label="Exemplo do Ninho da Família">
      <div className={styles.previewTopbar}>
        <div>
          <span className={styles.previewEyebrow}>Ninho da Família</span>
          <strong>Acompanhando o aluno</strong>
        </div>
        <span className={styles.statusOk}>Acompanhamento ativo</span>
      </div>

      <div className={styles.metricGrid}>
        <div><strong>12</strong><span>Missões concluídas</span></div>
        <div><strong>2</strong><span>Missões pendentes</span></div>
        <div><strong>74%</strong><span>Progresso observado</span></div>
      </div>

      <div className={styles.previewList}>
        <div className={styles.previewRow}>
          <span className={styles.dotBlue} />
          <div><small>Próximo encontro</small><strong>Matemática · terça, 16h</strong></div>
        </div>
        <div className={styles.previewRow}>
          <span className={styles.dotPink} />
          <div><small>Feedback recente</small><strong>Boa evolução na resolução de problemas.</strong></div>
        </div>
      </div>
    </article>
  );
}

function StudentPreview() {
  return (
    <article className={`${styles.previewCard} ${styles.studentPreview}`} aria-label="Exemplo do Portal do Aluno">
      <div className={styles.previewTopbar}>
        <div>
          <span className={styles.previewEyebrow}>Portal do Aluno</span>
          <strong>Suas missões de hoje</strong>
        </div>
        <span className={styles.starBadge}>★ 28</span>
      </div>

      <div className={styles.missionBox}>
        <div className={styles.missionMeta}><span>Matemática</span><b>Em andamento</b></div>
        <strong>Frações no dia a dia</strong>
        <small>Resolva situações usando diferentes representações.</small>
        <div className={styles.progressTrack}><span style={{ width: "60%" }} /></div>
      </div>

      <div className={styles.missionBox}>
        <div className={styles.missionMeta}><span>Língua Portuguesa</span><b>Começar</b></div>
        <strong>Ideia principal do texto</strong>
        <small>Leia, pense e explique com suas palavras.</small>
      </div>

      <div className={styles.notebookLine}><span>Meu Caderno</span><strong>1 atividade para fazer à mão</strong></div>
    </article>
  );
}

function ProgressPreview() {
  return (
    <article className={styles.previewCard} aria-label="Exemplo da visão de progresso">
      <div className={styles.previewTopbar}>
        <div>
          <span className={styles.previewEyebrow}>Meu Caminho</span>
          <strong>O que está evoluindo</strong>
        </div>
        <span className={styles.statusSoft}>Últimas evidências</span>
      </div>

      <div className={styles.skillList}>
        <div className={styles.skillRow}>
          <div><strong>Resolução de problemas</strong><small>Domínio observado</small></div>
          <div className={styles.skillMeter}><span /><span /><span /><i /></div>
          <b className={styles.trendUp}>Melhorando</b>
        </div>
        <div className={styles.skillRow}>
          <div><strong>Leitura e interpretação</strong><small>Domínio observado</small></div>
          <div className={styles.skillMeter}><span /><span /><span /><i /></div>
          <b className={styles.trendStable}>Estável</b>
        </div>
        <div className={styles.skillRow}>
          <div><strong>Organização dos estudos</strong><small>Em desenvolvimento</small></div>
          <div className={styles.skillMeter}><span /><span /><i /><i /></div>
          <b className={styles.trendAttention}>Atenção</b>
        </div>
      </div>

      <p className={styles.previewFootnote}>A visão é construída com evidências do acompanhamento, sem transformar uma única atividade em diagnóstico.</p>
    </article>
  );
}

export function PublicTrustSection() {
  return (
    <section className={`section ${styles.section}`} aria-labelledby="public-trust-title">
      <div className="site-shell">
        <div className={styles.intro}>
          <div>
            <div className="eyebrow eyebrow-blue">Por dentro do Plumareli</div>
            <h2 id="public-trust-title">A família entende o que está acontecendo. O aluno sabe qual é o próximo passo.</h2>
          </div>
          <div className={styles.introSide}>
            <p>Em vez de espalhar a rotina em mensagens, arquivos e anotações, o Plumareli reúne acompanhamento, atividades e evolução em espaços próprios para cada pessoa.</p>
            <span>Prévia baseada nas telas reais do produto · dados ilustrativos</span>
          </div>
        </div>

        <div className={styles.productGrid}>
          <FamilyPreview />
          <StudentPreview />
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

        <div className={styles.ctaBand}>
          <div>
            <strong>Quer entender como esse acompanhamento funcionaria na rotina do seu filho?</strong>
            <span>Conte o momento escolar atual e a equipe entra em contato para orientar os próximos passos.</span>
          </div>
          <div className={styles.ctaActions}>
            <a className="button button-primary" href="#quero-conhecer">Quero conhecer o Plumareli</a>
            <a className={styles.textLink} href="#plano">Ver planos</a>
          </div>
        </div>
      </div>
    </section>
  );
}
