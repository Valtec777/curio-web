import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { FaqAccordion } from "@/components/faq-accordion";
import { PublicTrustSection } from "@/components/public-trust-section";
import { createEnrollmentRequest } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

const experiences = [
  ["Missão Cuca", "Desafios digitais curtos para praticar conteúdos e acompanhar a evolução."],
  ["Caderno Plumareli", "Atividades fora da tela para exercitar escrita, raciocínio e produção própria."],
  ["Modo Pensar", "Trilhas complementares para ampliar repertório, autonomia e novas habilidades."],
  ["Meu Caminho", "Uma visão simples do progresso, das conquistas e dos próximos passos."],
  ["Modo Prova", "Revisão organizada para ajudar o aluno a se preparar com mais segurança."],
] as const;

const gradeOptions = [
  "1º ano",
  "2º ano",
  "3º ano",
  "4º ano",
  "5º ano",
  "6º ano",
  "7º ano",
  "8º ano",
  "9º ano",
  "1º ano do Ensino Médio",
  "2º ano do Ensino Médio",
  "3º ano do Ensino Médio",
] as const;

const mascots = [
  { slug: "capivara", name: "Capivara", trait: "Calma e organização", tone: "green", line: "Respira. Vamos por partes.", fallback: "/mascotes/curio_capivara_principal_acolhendo.png" },
  { slug: "boto-cor-de-rosa", name: "Boto", trait: "Imaginação e criatividade", tone: "pink", line: "E se a gente pensar de outro jeito?", fallback: "/mascotes/curio_boto_principal_imaginando_saudando.png" },
  { slug: "arara-azul", name: "Arara", trait: "Comunicação e expressão", tone: "blue", line: "Agora me conta com suas palavras.", fallback: "/mascotes/curio_arara_principal_saudando.png" },
  { slug: "mico-leao-dourado", name: "Mico-leão-dourado", trait: "Prática e persistência", tone: "yellow", line: "Bora testar se você pegou?", fallback: "/mascotes/plumareli_mico_leao_dourado_principal.webp" },
  { slug: "tamandua-bandeira", name: "Tamanduá", trait: "Investigação e atenção", tone: "green", line: "Tem alguma pista escondida aqui.", fallback: "/mascotes/curio_tamandua_principal_saudando.png" },
  { slug: "onca-pintada", name: "Onça", trait: "Coragem e confiança", tone: "pink", line: "Difícil não significa impossível.", fallback: "/mascotes/curio_onca_principal_heroica.png" },
] as const;

const faqItems = [
  ["Para quais anos o Plumareli atende?", "O Plumareli está preparado para acompanhar estudantes do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio, respeitando a idade, a série e as necessidades de cada aluno."],
  ["Como acontecem os encontros?", "Os encontros são online e fazem parte de um percurso de acompanhamento organizado para cada aluno."],
  ["O acompanhamento é individual?", "O percurso é organizado por aluno e pode incluir encontros individuais e outras estratégias pedagógicas quando fizer sentido."],
  ["As atividades precisam ser feitas no caderno?", "Algumas sim. O Caderno Plumareli mantém escrita, raciocínio e produção fora da tela como parte da aprendizagem."],
  ["O Plumareli ajuda em semanas de prova?", "Sim. O Modo Prova organiza conteúdos e atividades de revisão para apoiar a preparação."],
  ["Como a família acompanha a evolução?", "A família acompanha atividades, agenda, progresso, relatórios e próximos passos em uma área própria."],
  ["Como funciona o pagamento?", "O Plumareli possui planos com diferentes ritmos de acompanhamento. As condições do plano contratado ficam disponíveis para a família após a matrícula."],
  ["Posso cancelar?", "Sim, de acordo com as condições do plano e do contrato vigente."],
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "EducationalOrganization",
      "@id": "#plumareli",
      name: "PLUMARELI",
      description: "Acompanhamento escolar personalizado do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio, com missões, atividades no caderno, Modo Pensar e acompanhamento humano.",
      areaServed: "BR",
      knowsAbout: [
        "acompanhamento escolar",
        "reforço escolar",
        "aprendizagem personalizada",
        "organização dos estudos",
        "preparação para avaliações",
      ],
    },
    {
      "@type": "Service",
      "@id": "#acompanhamento",
      name: "Acompanhamento Escolar PLUMARELI",
      provider: { "@id": "#plumareli" },
      serviceType: "Acompanhamento escolar personalizado",
      audience: { "@type": "EducationalAudience", educationalRole: "student" },
      description: "Missões personalizadas, Caderno Plumareli, acompanhamento da evolução, preparação para avaliações e trilhas do Modo Pensar.",
    },
    {
      "@type": "FAQPage",
      mainEntity: faqItems.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default async function Home({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead } = await searchParams;
  const supabase = await createClient();
  const [{ data: publicPlans }, { data: legalDocuments }, { data: characters }] = await Promise.all([
    supabase
      .from("plans")
      .select("id,name,description,monthly_price,features,meetings_per_month,delivery_mode,badge,sort_order,available_for_enrollment")
      .eq("active", true)
      .eq("visible_on_landing", true)
      .is("archived_at", null)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("legal_documents")
      .select("title,public_slug,document_type,body,file_path")
      .eq("status", "published")
      .eq("is_current", true)
      .order("document_type"),
    supabase
      .from("characters")
      .select("slug,assets")
      .eq("active", true),
  ]);
  const startingPrice = publicPlans?.length ? Math.min(...publicPlans.map((plan: any) => Number(plan.monthly_price || 0))) : null;
  const characterImages = new Map<string, string>(
    (characters ?? []).map((character: any) => [
      character.slug,
      character.assets?.principal || character.assets?.avatar || "",
    ]),
  );
  const mascotImage = (slug: string, fallback: string) => characterImages.get(slug) || fallback;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <header className="public-header">
        <div className="site-shell public-header-inner">
          <Logo />
          <nav className="public-nav" aria-label="Navegação do site">
            <a href="#inicio">Início</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#o-que-recebe">Experiência</a>
            <a href="#metodo">Método</a>
            <a href="#cursos">Modo Pensar</a>
            <a href="#plano">Planos</a>
            <a href="#sobre">Sobre</a>
            <a href="#faq">Dúvidas</a>
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
              <div className="kicker kicker-pill">Acompanhamento escolar online</div>
              <h1>Acompanhamento escolar que <span className="hero-highlight-blue">entende o momento</span> do aluno e ajuda a <span className="hero-highlight-pink">avançar.</span></h1>
              <p className="hero-grade">Do <strong>1º ano do Ensino Fundamental</strong> ao <strong>3º ano do Ensino Médio.</strong></p>
              <p>Missões, atividades no caderno, encontros e acompanhamento humano em uma rotina organizada para aprender com mais clareza e autonomia.</p>
              <p className="brain-line"><span>Tecnologia ajuda.</span> Seu cérebro resolve.</p>
              <div className="hero-buttons">
                <a className="button button-primary" href="#quero-conhecer">Quero conhecer o Plumareli</a>
                <a className="button button-pink" href="#como-funciona">Ver como funciona</a>
              </div>
              <div className="hero-chips">
                <span>Acompanhamento humano</span>
                <span>Progresso fácil de acompanhar</span>
                <span>Aprendizagem além da tela</span>
              </div>
            </div>

            <div className="hero-mascot-stage" aria-label="Irara, personagem do universo Plumareli">
              <div className="mascot-orbit mascot-orbit-main"><Image src={mascotImage("irara", "/mascotes/plumareli_irara_principal.webp")} alt="Irara do Plumareli" width={430} height={520} priority /></div>
              <div className="kicker kicker-pill">Irara · curiosidade em movimento</div>
            </div>
          </div>
        </section>

        <PublicTrustSection />

        <section className="section" id="como-funciona">
          <div className="site-shell">
            <div className="section-heading">
              <div className="eyebrow eyebrow-green">Como funciona</div>
              <h2>Um acompanhamento que organiza o próximo passo.</h2>
              <p>O aluno pratica, recebe orientação e avança com atividades adequadas ao que está estudando e ao que precisa fortalecer.</p>
            </div>
            <div className="steps-grid">
              {[
                ["01", "Entendemos", "Observamos o momento do aluno, os conteúdos atuais e as principais necessidades."],
                ["02", "Organizamos", "Definimos um caminho de estudo claro, com prioridades e atividades adequadas."],
                ["03", "Praticamos", "O aluno pensa, responde, escreve, revisa e exercita o que está aprendendo."],
                ["04", "Acompanhamos", "A evolução é acompanhada para orientar os próximos passos."],
              ].map(([number, title, text]) => <article className="step-card" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="section section-soft" id="o-que-recebe">
          <div className="site-shell">
            <div className="section-heading">
              <div className="eyebrow eyebrow-pink">Experiência Plumareli</div>
              <h2>Recursos que trabalham juntos na rotina de estudos.</h2>
            </div>
            <div className="experience-grid">
              {experiences.map(([title, text], index) => <article className="experience-card" key={title}><span className="experience-number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}
              <article className="experience-card experience-dashed"><strong>Pense · Crie · Resolva</strong><p>Uma rotina que valoriza compreensão, prática e autonomia.</p></article>
            </div>
          </div>
        </section>

        <section className="section section-dark method-band" id="metodo">
          <div className="site-shell">
            <div className="eyebrow eyebrow-yellow">Método</div>
            <h2 className="method-title">Tecnologia ajuda. <span>Seu cérebro resolve.</span></h2>
            <p className="method-intro">A tecnologia organiza a experiência, mas o aprendizado acontece quando o aluno pensa, tenta, pratica, revisa e entende o próprio caminho.</p>
            <div className="method-flow" aria-label="Etapas do método Plumareli">
              {[["Tente", "blue"], ["Entenda", "pink"], ["Pratique", "lime"], ["Escreva", "yellow"], ["Confira", "blue"], ["Avance", "pink"]].map(([label, tone], index) => (
                <div className="method-flow-item" key={label}><span className={`method-dot method-dot-${tone}`}>{label}</span>{index < 5 && <b>→</b>}</div>
              ))}
            </div>
            <div className="method-callout">Errar faz parte do processo. <strong>O importante é entender, ajustar e continuar.</strong></div>
          </div>
        </section>

        <section className="section" id="universo">
          <div className="site-shell">
            <div className="section-heading">
              <div className="eyebrow eyebrow-green">Universo Plumareli</div>
              <h2>Personagens que acompanham diferentes momentos de aprender.</h2>
              <p>Cada personagem representa uma atitude importante para estudar: calma, criatividade, comunicação, prática, investigação e coragem.</p>
            </div>
            <div className="mascot-grid mascot-free-grid">
              {mascots.map((mascot) => (
                <article className={`mascot-character mascot-tone-${mascot.tone}`} key={mascot.name}>
                  <div className="mascot-image-free"><Image src={mascotImage(mascot.slug, mascot.fallback)} alt={mascot.name} width={310} height={340} /></div>
                  <div className="mascot-caption"><span className="mascot-name-pill">{mascot.name}</span><h3>{mascot.trait}</h3><p>“{mascot.line}”</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section map-promise-section">
          <div className="site-shell map-promise-grid">
            <div>
              <div className="eyebrow">Acompanhamento</div>
              <h2>Mais clareza sobre o que está evoluindo.</h2>
              <p>A família e o professor conseguem acompanhar o que está sendo estudado, pontos fortes, habilidades em desenvolvimento e os próximos objetivos.</p>
            </div>
            <div className="map-mini-card">
              <div><span>Estudando agora</span><strong>Conteúdo atual</strong></div>
              <div><span>Ponto forte</span><strong>O que já está avançando</strong></div>
              <div><span>Em desenvolvimento</span><strong>O que precisa de prática</strong></div>
              <div><span>Próximo passo</span><strong>Objetivo do acompanhamento</strong></div>
              <small>Uma visão simples para orientar a rotina de estudos.</small>
            </div>
          </div>
        </section>

        <section className="section course-public-section" id="cursos">
          <div className="site-shell course-public-grid">
            <div className="course-public-copy">
              <div className="eyebrow eyebrow-green">Modo Pensar</div>
              <h2>Aprender também é descobrir novos interesses.</h2>
              <p>O Modo Pensar reúne trilhas complementares sobre temas que ampliam repertório, comunicação, criatividade, organização e outras habilidades importantes.</p>
              <p>As trilhas podem combinar textos, materiais, atividades, vídeos e quizzes. Quando houver certificado, ele é liberado após a conclusão dos requisitos.</p>
              <div className="course-public-pills"><span>No próprio ritmo</span><span>Conteúdo complementar</span><span>Certificado quando disponível</span></div>
            </div>
            <div className="course-public-card">
              <span className="course-public-badge">Modo Pensar</span>
              <h3>Trilhas para mentes curiosas</h3>
              <div className="course-public-step"><b>01</b><span>Escolha uma trilha disponível</span></div>
              <div className="course-public-step"><b>02</b><span>Avance pelas etapas</span></div>
              <div className="course-public-step"><b>03</b><span>Conclua no seu ritmo</span></div>
              <div className="course-public-step"><b>04</b><span>Receba o certificado, quando houver</span></div>
            </div>
          </div>
        </section>

        <section className="section" id="plano">
          <div className="site-shell">
            <div className="section-heading">
              <div className="eyebrow eyebrow-yellow">Planos Plumareli</div>
              <h2>Escolha o ritmo de acompanhamento que combina com a rotina.</h2>
              <p>Os recursos e a quantidade de encontros são definidos em cada plano e podem variar conforme a configuração vigente.</p>
            </div>
            {publicPlans?.length ? (
              <div className="public-plan-grid">
                {publicPlans.map((plan: any) => (
                  <article className={`public-plan-card ${plan.badge === "Recomendado" ? "public-plan-featured" : ""}`} key={plan.id}>
                    <div className="flex gap-8 wrap"><span className="public-plan-badge">{plan.badge || "Plumareli"}</span></div>
                    <h3>{plan.name}</h3>
                    <p>{plan.description}</p>
                    <div className="public-plan-price"><strong>R$ {Number(plan.monthly_price || 0).toFixed(0)}</strong><span>/ mês</span></div>
                    <div className="public-plan-meta"><span>{plan.meetings_per_month} encontros/mês</span><span>{plan.delivery_mode === "online" ? "Online" : plan.delivery_mode}</span></div>
                    {(plan.features || []).length ? <ul>{(plan.features || []).slice(0, 5).map((feature: string) => <li key={feature}>✓ {feature}</li>)}</ul> : null}
                    <a className={`button ${plan.badge === "Recomendado" ? "button-primary" : "button-secondary"}`} href="#quero-conhecer">Quero conhecer</a>
                  </article>
                ))}
              </div>
            ) : (
              <div className="plan-panel"><div><h2>Conheça o acompanhamento Plumareli</h2><p>Entre em contato para entender qual ritmo combina melhor com a rotina do aluno.</p></div><a className="button button-primary" href="#quero-conhecer">Quero conhecer</a></div>
            )}
          </div>
        </section>

        <section className="section section-soft" id="quero-conhecer">
          <div className="site-shell lead-grid">
            <div className="lead-copy">
              <div className="eyebrow eyebrow-pink">Quero conhecer o Plumareli</div>
              <h2>Deixe seu contato para conhecer o Plumareli.</h2>
              <p>Pedimos só os dados necessários para retornar o contato. Informações detalhadas sobre o aluno ficam para a etapa de matrícula, se você decidir seguir.</p>
              <div className="lead-price"><strong>{startingPrice ? `Planos a partir de R$ ${startingPrice.toFixed(0)}/mês` : "Acompanhamento personalizado"}</strong><span>Encontros online · Missões Cuca · Caderno Plumareli · acompanhamento da evolução</span></div>
            </div>

            <form className="lead-form" action={createEnrollmentRequest}>
              {lead === "sucesso" && <div className="form-message form-success">Recebemos seu interesse. A equipe Plumareli entrará em contato.</div>}
              {lead === "erro" && <div className="form-message form-error">Não foi possível enviar agora. Confira os campos e tente novamente.</div>}
              <div className="form-row">
                <div className="field"><label>Nome do responsável *</label><input className="input" name="guardian_name" required maxLength={120} autoComplete="name" placeholder="Seu nome" /></div>
                <div className="field"><label>WhatsApp *</label><input className="input" name="phone_whatsapp" required maxLength={40} inputMode="tel" autoComplete="tel" placeholder="(71) 9 ....-...." /></div>
              </div>
              <div className="field"><label>E-mail *</label><input className="input" type="email" name="email" required maxLength={320} autoComplete="email" placeholder="voce@exemplo.com" /></div>
              <div className="field"><label>Ano escolar *</label><select className="select" name="grade_name" required defaultValue=""><option value="" disabled>Selecione</option>{gradeOptions.map((grade) => <option key={grade}>{grade}</option>)}</select></div>
              <p className="muted">Nesta etapa não pedimos nome da criança, dificuldades detalhadas, matérias ou arquivos.</p>
              <label className="consent-line">
                <input type="checkbox" name="consent_contact" required />
                <span>Autorizo o contato do Plumareli sobre esta solicitação e declaro que li a <Link href="/legal/politica-de-privacidade">Política de Privacidade</Link>.</span>
              </label>
              <button className="button button-primary button-block" type="submit">Quero conhecer o Plumareli</button>
            </form>
          </div>
        </section>

        <section className="section" id="sobre">
          <div className="site-shell about-grid">
            <div>
              <div className="eyebrow">Sobre o Plumareli</div>
              <h2>Uma plataforma para organizar o acompanhamento escolar.</h2>
              <p>O Plumareli reúne encontros, atividades, materiais, acompanhamento da evolução e comunicação em uma experiência única para aluno, família e professor.</p>
              <p>A proposta é tornar a rotina de estudos mais clara, acolhedora e estimulante, preservando o acompanhamento humano em cada etapa.</p>
            </div>
            <div className="about-quote"><strong>Curiosidade move o mundo.</strong><span>Tecnologia ajuda.</span><b>Seu cérebro resolve.</b></div>
          </div>
        </section>

        <section className="section section-soft" id="faq">
          <div className="site-shell">
            <div className="section-heading"><div className="eyebrow eyebrow-pink">Dúvidas frequentes</div><h2>Antes de começar</h2></div>
            <FaqAccordion items={faqItems} />
          </div>
        </section>
      </main>

      <footer className="footer curio-footer">
        <div className="site-shell footer-grid">
          <div><Logo /><p>Curiosidade move o mundo. Tecnologia ajuda. Seu cérebro resolve.</p></div>
          <div><strong>Conheça</strong><a href="#como-funciona">Como funciona</a><a href="#metodo">Método</a></div>
          <div><strong>Experiência</strong><a href="#o-que-recebe">Recursos</a><a href="#cursos">Modo Pensar</a><a href="#plano">Planos</a></div>
          <div><strong>Plumareli</strong><a href="#sobre">Sobre</a><a href="#faq">Dúvidas</a><a href="#quero-conhecer">Fale com a equipe</a></div>
        </div>
        <div className="site-shell legal-footer-links">
          {(legalDocuments ?? []).filter((doc: any) => doc.body || doc.file_path).map((doc: any) => <Link key={doc.public_slug} href={`/legal/${doc.public_slug}`}>{doc.title || doc.document_type}</Link>)}
        </div>
        <div className="site-shell footer-bottom"><span>© 2026 Plumareli. Acompanhamento escolar para mentes curiosas.</span><span>Atendimento pelo formulário do site.</span></div>
      </footer>
    </>
  );
}