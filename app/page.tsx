import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { FaqAccordion } from "@/components/faq-accordion";
import { PublicTrustSection } from "@/components/public-trust-section";
import { createEnrollmentRequest } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

const experiences = [
  ["Missão Cuca", "Desafios digitais rápidos para identificar, praticar e transformar respostas em evidências."],
  ["Caderno Curió", "Atividades obrigatórias fora da tela para exercitar escrita, raciocínio e autoria."],
  ["Modo Pensar", "Cursos livres criados pelo Curió para ampliar repertório e autonomia, com certificado nas trilhas concluídas."],
  ["Meu Caminho", "Mostra evolução, conquistas e habilidades que ainda precisam ser praticadas."],
  ["Modo Prova", "Revisão especial que reúne conteúdos e habilidades antes das avaliações."],
];

const mascots = [
  { name: "Capivara", trait: "Calma e organização", tone: "green", line: "Respira. Vamos por partes.", image: "/mascotes/curio_capivara_principal_acolhendo.png" },
  { name: "Boto", trait: "Imaginação e criatividade", tone: "pink", line: "E se a gente pensar de outro jeito?", image: "/mascotes/curio_boto_principal_imaginando_saudando.png" },
  { name: "Arara", trait: "Comunicação e expressão", tone: "blue", line: "Agora me conta com suas palavras.", image: "/mascotes/curio_arara_principal_saudando.png" },
  { name: "Mico", trait: "Prática e persistência", tone: "yellow", line: "Bora testar se você pegou?", image: "/mascotes/curio_mico_principal_praticando.png" },
  { name: "Tamanduá", trait: "Investigação e atenção", tone: "green", line: "Tem alguma pista escondida aqui.", image: "/mascotes/curio_tamandua_principal_saudando.png" },
  { name: "Onça", trait: "Coragem e confiança", tone: "pink", line: "Difícil não significa impossível.", image: "/mascotes/curio_onca_principal_heroica.png" },
];

const faqItems = [
  ["Para quais anos o Curió atende?", "Atendemos crianças e adolescentes do 1º ao 8º ano, com atividades ajustadas à idade, série e realidade de cada estudante."],
  ["Como acontecem os encontros?", "Os encontros são online e fazem parte de um percurso personalizado de acompanhamento."],
  ["O acompanhamento é individual?", "O plano é personalizado por aluno e pode incluir intervenções individuais e grupos pedagógicos quando fizer sentido."],
  ["As atividades precisam ser feitas no caderno?", "Algumas sim. O Caderno Curió preserva escrita, raciocínio e produção fora da tela."],
  ["O Curió ajuda em semanas de prova?", "Sim. O Modo Prova organiza revisão e prática com base nos conteúdos atuais e nas habilidades que precisam de atenção."],
  ["Como os responsáveis acompanham a evolução?", "A família recebe uma visão objetiva e adequada do progresso, sem exposição de classificações internas desnecessárias."],
  ["Como funciona o pagamento?", "O Curió possui planos mensais com diferentes ritmos de acompanhamento. Condições, contrato e pagamentos ficam disponíveis no Ninho da Família após a matrícula."],
  ["Posso cancelar?", "Sim, respeitando as condições previstas no contrato do plano contratado."],
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "EducationalOrganization",
      "@id": "#curio",
      name: "CURIÓ",
      description: "Acompanhamento escolar personalizado do 1º ao 8º ano, com missões, atividades no caderno, cursos livres e acompanhamento humano.",
      email: "curio.educacao@gmail.com",
      areaServed: "BR",
      knowsAbout: [
        "acompanhamento escolar",
        "reforço escolar",
        "aprendizagem personalizada",
        "habilidades de estudo",
        "cursos livres para crianças e adolescentes"
      ]
    },
    {
      "@type": "Service",
      "@id": "#acompanhamento",
      name: "Acompanhamento Escolar CURIÓ",
      provider: { "@id": "#curio" },
      serviceType: "Acompanhamento escolar personalizado",
      audience: { "@type": "EducationalAudience", educationalRole: "student" },
      description: "Missões personalizadas, atividades no Caderno Curió, acompanhamento de habilidades, preparação para avaliações e cursos livres."
    },
    {
      "@type": "FAQPage",
      mainEntity: faqItems.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer }
      }))
    }
  ]
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead } = await searchParams;
  const supabase = await createClient();
  const [{ data: publicPlans }, { data: legalDocuments }] = await Promise.all([
    supabase.from("plans").select("id,name,description,monthly_price,features,meetings_per_month,delivery_mode,badge,sort_order,available_for_enrollment").eq("active", true).eq("visible_on_landing", true).is("archived_at", null).is("deleted_at", null).order("sort_order"),
    supabase.from("legal_documents").select("title,public_slug,document_type,body,file_path").eq("status", "published").eq("is_current", true).order("document_type"),
  ]);
  const startingPrice = publicPlans?.length ? Math.min(...publicPlans.map((plan: any) => Number(plan.monthly_price || 0))) : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="public-header">
        <div className="site-shell public-header-inner">
          <Logo />
          <nav className="public-nav" aria-label="Navegação do site">
            <a href="#inicio">Início</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#o-que-recebe">O que recebe</a>
            <a href="#metodo">Método</a>
            <a href="#cursos">Cursos livres</a>
            <a href="#plano">Plano</a>
            <a href="#sobre">Sobre</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="public-actions">
            <Link className="button button-secondary" href="/login">Entrar</Link>
            <a className="button button-primary" href="#quero-conhecer">Quero conhecer</a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero curio-public-hero" id="inicio">
          <div className="site-shell hero-grid">
            <div className="hero-copy">
              <div className="kicker kicker-pill">Vagas abertas</div>
              <h1>Acompanhamento escolar que <span className="hero-highlight-blue">descobre como</span> seu filho <span className="hero-highlight-pink">aprende.</span></h1>
              <p className="hero-grade">Para crianças do <strong>1º ao 8º ano.</strong></p>
              <p>
                Missões personalizadas, atividades no caderno e acompanhamento humano para transformar dificuldade em evolução visível.
              </p>
              <p className="brain-line"><span>Tecnologia ajuda.</span> Seu cérebro resolve.</p>
              <div className="hero-buttons">
                <a className="button button-primary" href="#quero-conhecer">Quero conhecer o Curió</a>
                <a className="button button-pink" href="#como-funciona">Ver como funciona</a>
              </div>
              <div className="hero-chips">
                <span>Acompanhamento humano</span>
                <span>Progresso visível</span>
                <span>Aprendizagem além da tela</span>
              </div>
            </div>

            <div className="hero-mascot-stage" aria-label="Personagens do universo Curió">
              <div className="mascot-orbit mascot-orbit-main">
                <Image src="/mascotes/curio_capivara_principal_acolhendo.png" alt="Capivara do Curió" width={360} height={420} priority />
              </div>
              <div className="mascot-orbit mascot-orbit-top">
                <Image src="/mascotes/curio_onca_principal_heroica.png" alt="Onça do Curió" width={230} height={270} priority />
              </div>
              <div className="mascot-orbit mascot-orbit-bottom">
                <Image src="/mascotes/curio_boto_principal_imaginando_saudando.png" alt="Boto do Curió" width={230} height={270} priority />
              </div>
              <div className="hero-sticker sticker-stars">★  ★  ★</div>
              <div className="hero-sticker sticker-note">Pense · Crie · Resolva</div>
            </div>
          </div>
        </section>

        <PublicTrustSection />

        <section className="section" id="como-funciona">
          <div className="site-shell">
            <div className="section-heading">
              <div className="eyebrow eyebrow-green">Como funciona</div>
              <h2>Um jeito diferente de acompanhar os estudos.</h2>
              <p>O Curió transforma cada atividade em informação útil para decidir o próximo passo, sem reduzir a criança a uma nota.</p>
            </div>
            <div className="steps-grid">
              {[
                ["01", "Descobrimos", "Identificamos o que a criança já sabe e onde precisa de ajuda."],
                ["02", "Entendemos", "O conteúdo é explicado de forma simples, visual e adequada à idade."],
                ["03", "Praticamos", "A criança pensa, responde, escreve no caderno e exercita o que aprendeu."],
                ["04", "Acompanhamos", "Revisamos a evolução e ajustamos as próximas atividades."],
              ].map(([n, title, text]) => (
                <article className="step-card" key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-soft" id="o-que-recebe">
          <div className="site-shell">
            <div className="section-heading">
              <div className="eyebrow eyebrow-pink">O que a criança recebe</div>
              <h2>Cinco experiências para aprender de verdade.</h2>
            </div>
            <div className="experience-grid">
              {experiences.map(([title, text], index) => (
                <article className="experience-card" key={title}>
                  <span className="experience-number">0{index + 1}</span>
                  <h3>{title}</h3><p>{text}</p>
                </article>
              ))}
              <article className="experience-card experience-dashed">
                <strong>Pense · Crie · Resolva</strong>
                <p>Um método completo que desenvolve autonomia, criatividade e foco.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section-dark method-band" id="metodo">
          <div className="site-shell">
            <div className="eyebrow eyebrow-yellow">Método</div>
            <h2 className="method-title">Tecnologia ajuda. <span>Seu cérebro resolve.</span></h2>
            <p className="method-intro">O Curió não entrega respostas prontas como método de estudo. A criança pensa, tenta e revisa para aprender de verdade — com a tecnologia a favor, nunca no lugar do raciocínio.</p>
            <div className="method-flow" aria-label="Etapas do método Curió">
              {[
                ["Tente", "blue"], ["Entenda", "pink"], ["Pratique", "lime"], ["Escreva", "yellow"], ["Confira", "blue"], ["Avance", "pink"],
              ].map(([label, tone], index) => (
                <div className="method-flow-item" key={label}><span className={`method-dot method-dot-${tone}`}>{label}</span>{index < 5 && <b>→</b>}</div>
              ))}
            </div>
            <div className="method-callout">Aqui, errar não é fracassar. <strong>É descobrir o que precisamos praticar.</strong></div>
          </div>
        </section>

        <section className="section" id="universo">
          <div className="site-shell">
            <div className="section-heading">
              <div className="eyebrow eyebrow-green">Universo Curió</div>
              <h2>Seis formas de aprender, um bando de curiosos.</h2>
              <p>Eles não representam uma disciplina. Representam jeitos de pensar, sentir e resolver.</p>
            </div>
            <div className="mascot-grid mascot-free-grid">
              {mascots.map((mascot) => (
                <article className={`mascot-character mascot-tone-${mascot.tone}`} key={mascot.name}>
                  <div className="mascot-image-free"><Image src={mascot.image} alt={mascot.name} width={310} height={340} /></div>
                  <div className="mascot-caption">
                    <span className="mascot-name-pill">{mascot.name}</span>
                    <h3>{mascot.trait}</h3>
                    <p>“{mascot.line}”</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section map-promise-section">
          <div className="site-shell map-promise-grid">
            <div>
              <div className="eyebrow">Acompanhamento 360º</div>
              <h2>Acompanhamos mais do que notas.</h2>
              <p>O Curió identifica o conteúdo estudado, as habilidades demonstradas, o nível de autonomia, as evidências e a evolução ao longo do tempo.</p>
            </div>
            <div className="map-mini-card">
              <div><span>Estudando agora</span><strong>Brasil Imperial</strong></div>
              <div><span>Facilidade</span><strong>Localizar informações</strong></div>
              <div><span>Em desenvolvimento</span><strong>Comparar períodos</strong></div>
              <div><span>Próximo passo</span><strong>Missão de comparação</strong></div>
              <small>O sistema sugere. A professora revisa e confirma.</small>
            </div>
          </div>
        </section>

        <section className="section course-public-section" id="cursos">
          <div className="site-shell course-public-grid">
            <div className="course-public-copy">
              <div className="eyebrow eyebrow-green">Cursos Livres · Modo Pensar</div>
              <h2>Curiosidade também aprende fora do conteúdo da prova.</h2>
              <p>Além do acompanhamento escolar, o Curió oferece <strong>cursos livres</strong> criados e publicados pela nossa Administração. São trilhas curtas para desenvolver repertório, comunicação, criatividade, tecnologia, organização e outros temas que façam sentido para crianças e adolescentes.</p>
              <p>O aluno acompanha o próprio progresso dentro do Modo Pensar e, nas trilhas certificáveis, recebe <strong>certificado de conclusão com código de validação</strong>.</p>
              <div className="course-public-pills"><span>Trilhas no próprio ritmo</span><span>Conteúdo extra</span><span>Certificado de conclusão</span></div>
            </div>
            <div className="course-public-card">
              <span className="course-public-badge">Modo Pensar</span>
              <h3>Cursos para mentes curiosas</h3>
              <div className="course-public-step"><b>01</b><span>Escolha uma trilha</span></div>
              <div className="course-public-step"><b>02</b><span>Avance pelas etapas</span></div>
              <div className="course-public-step"><b>03</b><span>Conclua no seu ritmo</span></div>
              <div className="course-public-step"><b>04</b><span>Receba seu certificado</span></div>
              <small>Os cursos disponíveis podem mudar conforme novas trilhas forem publicadas.</small>
            </div>
          </div>
        </section>

        <section className="section" id="plano">
          <div className="site-shell">
            <div className="section-heading">
              <div className="eyebrow eyebrow-yellow">Planos Curió</div>
              <h2>Escolha o ritmo de acompanhamento que combina com a rotina.</h2>
            </div>
            {publicPlans?.length ? <div className="public-plan-grid">{publicPlans.map((plan: any) => <article className={`public-plan-card ${plan.badge === "Recomendado" ? "public-plan-featured" : ""}`} key={plan.id}>
              <div className="flex gap-8 wrap"><span className="public-plan-badge">{plan.badge || "Curió"}</span></div>
              <h3>{plan.name}</h3><p>{plan.description}</p>
              <div className="public-plan-price"><strong>R$ {Number(plan.monthly_price || 0).toFixed(0)}</strong><span>/ mês</span></div>
              <div className="public-plan-meta"><span>{plan.meetings_per_month} encontros/mês</span><span>{plan.delivery_mode === "online" ? "Online" : plan.delivery_mode}</span></div>
              {(plan.features || []).length ? <ul>{(plan.features || []).slice(0, 5).map((feature: string) => <li key={feature}>✓ {feature}</li>)}</ul> : null}
              <a className={`button ${plan.badge === "Recomendado" ? "button-primary" : "button-secondary"}`} href="#quero-conhecer">Quero conhecer</a>
            </article>)}</div> : <div className="plan-panel"><div><h2>Planos em organização</h2><p>Entre em contato para conhecer o acompanhamento Curió.</p></div><a className="button button-primary" href="#quero-conhecer">Quero conhecer</a></div>}
          </div>
        </section>

        <section className="section section-soft" id="quero-conhecer">
          <div className="site-shell lead-grid">
            <div className="lead-copy">
              <div className="eyebrow eyebrow-pink">Quero conhecer o Curió</div>
              <h2>Conte um pouco sobre a rotina escolar.</h2>
              <p>Com essas informações, a equipe orienta o plano e o ritmo de acompanhamento mais adequados.</p>
              <div className="lead-price"><strong>{startingPrice ? `Planos a partir de R$ ${startingPrice.toFixed(0)}/mês` : "Acompanhamento personalizado"}</strong><span>Encontros online · Missões Cuca · Caderno Curió · acompanhamento da evolução</span></div>
            </div>
            <form className="lead-form" action={createEnrollmentRequest}>
              {lead === "sucesso" && <div className="form-message form-success">Recebemos seu interesse. O Curió entrará em contato com você.</div>}
              {lead === "erro" && <div className="form-message form-error">Não foi possível enviar agora. Confira os campos e tente novamente.</div>}
              <div className="form-row">
                <div className="field"><label>Nome do responsável *</label><input className="input" name="guardian_name" required placeholder="Seu nome" /></div>
                <div className="field"><label>WhatsApp *</label><input className="input" name="phone_whatsapp" required placeholder="(71) 9 ....-...." /></div>
              </div>
              <div className="field"><label>E-mail *</label><input className="input" type="email" name="email" required placeholder="voce@exemplo.com" /></div>
              <div className="form-row">
                <div className="field"><label>Nome da criança</label><input className="input" name="child_name" placeholder="Nome da criança" /></div>
                <div className="field"><label>Idade da criança</label><input className="input" type="number" name="child_age" min="5" max="18" placeholder="6 a 14" /></div>
              </div>
              <div className="field"><label>Ano escolar *</label><select className="select" name="grade_name" required defaultValue=""><option value="" disabled>Selecione</option>{Array.from({ length: 8 }, (_, index) => `${index + 1}º ano`).map((grade) => <option key={grade}>{grade}</option>)}</select></div>
              <fieldset className="subject-fieldset"><legend>Matérias que precisam de acompanhamento</legend><div className="subject-checks">{["Língua Portuguesa", "Matemática", "Ciências", "História", "Geografia", "Inglês", "Outras"].map((subject) => <label key={subject}><input type="checkbox" name="subjects" value={subject} /> {subject}</label>)}</div></fieldset>
              <div className="field"><label>Principais dificuldades</label><textarea className="textarea" name="main_difficulties" placeholder="Conte o que mais preocupa hoje" /></div>
              <div className="field"><label>Mensagem (opcional)</label><textarea className="textarea" name="message" placeholder="Algo que queira compartilhar" /></div>
              <label className="consent-line"><input type="checkbox" name="consent_contact" required /> Autorizo o contato do Curió sobre esta solicitação.</label>
              <button className="button button-primary button-block" type="submit">Quero conhecer o Curió</button>
            </form>
          </div>
        </section>

        <section className="section" id="sobre">
          <div className="site-shell about-grid">
            <div>
              <div className="eyebrow">Sobre</div>
              <h2>Quem criou o Curió?</h2>
              <p>O Curió nasceu a partir da experiência de Ellen com acompanhamento escolar infantil e de sua formação em comunicação. Ellen é estudante de Relações Públicas da Universidade do Estado da Bahia (UNEB) e criou o projeto para tornar a rotina de estudos mais organizada, visual, acolhedora e estimulante.</p>
            </div>
            <div className="about-quote"><strong>Curiosidade move o mundo.</strong><span>Tecnologia ajuda.</span><b>Seu cérebro resolve.</b></div>
          </div>
        </section>

        <section className="section section-soft" id="faq">
          <div className="site-shell">
            <div className="section-heading"><div className="eyebrow eyebrow-pink">FAQ</div><h2>Perguntas frequentes</h2></div>
            <FaqAccordion items={faqItems} />
          </div>
        </section>
      </main>

      <footer className="footer curio-footer">
        <div className="site-shell footer-grid">
          <div><Logo /><p>Curiosidade move o mundo. Tecnologia ajuda. Seu cérebro resolve.</p></div>
          <div><strong>Como funciona</strong><a href="#como-funciona">Como funciona</a><a href="#metodo">Método</a></div>
          <div><strong>Recursos</strong><a href="#o-que-recebe">O que recebe</a><a href="#cursos">Cursos livres</a><a href="#plano">Plano</a></div>
          <div><strong>Curió</strong><a href="#sobre">Sobre</a><a href="#faq">FAQ</a><a href="mailto:curio.educacao@gmail.com">curio.educacao@gmail.com</a></div>
        </div>
        <div className="site-shell legal-footer-links">
          {(legalDocuments ?? []).filter((doc: any) => doc.body || doc.file_path).map((doc: any) => <Link key={doc.public_slug} href={`/legal/${doc.public_slug}`}>{doc.document_type}</Link>)}
        </div>
        <div className="site-shell footer-bottom"><span>© 2026 Curió. Para mentes curiosas do 1º ao 8º ano.</span><span>Contato: curio.educacao@gmail.com</span></div>
      </footer>
    </>
  );
}
