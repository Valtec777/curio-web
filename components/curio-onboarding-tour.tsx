"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import styles from "./curio-onboarding-tour.module.css";

type TutorialRole = "teacher" | "guardian" | "student";

type TourStep = {
  title: string;
  body: string;
  selector?: string;
};

type PageGuide = {
  title: string;
  purpose: string;
  tips: string[];
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const HOME_PATH: Record<TutorialRole, string> = {
  teacher: "/professor",
  guardian: "/familia",
  student: "/aluno",
};

const ROLE_NAME: Record<TutorialRole, string> = {
  teacher: "Portal do Professor",
  guardian: "Ninho da Família",
  student: "Espaço do Aluno",
};

const ROLE_TOURS: Record<TutorialRole, TourStep[]> = {
  teacher: [
    {
      title: "Bem-vindo(a) ao Portal do Professor",
      body: "Este tour mostra onde acompanhar alunos, organizar encontros, criar atividades e falar com as famílias. Você pode sair a qualquer momento e refazer depois.",
    },
    {
      selector: 'a[href="/professor"]',
      title: "Hoje: sua central de prioridades",
      body: "Comece por aqui. O painel reúne o que merece atenção agora: aulas, correções, mensagens, atividades aguardando aluno e próximos prazos.",
    },
    {
      selector: 'a[href="/professor/agenda"]',
      title: "Agenda e encontros",
      body: "Use a Agenda para marcar aulas, revisões e compromissos. A área de Reuniões organiza conversas com família, aluno ou Administração e mantém o link do encontro no mesmo lugar.",
    },
    {
      selector: 'a[href="/professor/alunos"]',
      title: "Acompanhamento dos alunos",
      body: "Em Alunos você enxerga progresso, pendências, matérias e próximos encontros. Planos e limites mostram o que cada aluno ainda tem disponível no ciclo atual.",
    },
    {
      selector: 'a[href="/professor/mapa"]',
      title: "Mapa e grupos pedagógicos",
      body: "O Mapa Pedagógico organiza evidências por habilidade. Grupos Pedagógicos ajudam a reunir necessidades semelhantes sem alterar a turma oficial.",
    },
    {
      selector: 'a[href="/professor/criar"], a[href="/professor/gerador"]',
      title: "Criar conteúdo",
      body: "Você pode começar por uma fonte, como texto, PDF, DOCX, PPTX ou imagem, ou abrir um editor final. Todo rascunho continua revisável antes de chegar ao aluno.",
    },
    {
      selector: 'a[href="/professor/missoes"]',
      title: "Missões, materiais e avaliações",
      body: "Essas áreas servem para publicar experiências diferentes: Missões com questões, Materiais de apoio, Cadernos e Avaliações. Conteúdos funciona como sua biblioteca para reutilizar o que já criou.",
    },
    {
      selector: 'a[href="/professor/correcoes"]',
      title: "Correções",
      body: "Aqui aparecem respostas abertas, Cadernos e resultados que precisam da sua revisão. Questões objetivas com gabarito podem ter conferência automática, mas a decisão pedagógica continua sendo sua.",
    },
    {
      selector: 'a[href="/professor/mensagens"]',
      title: "Mensagens e relatórios",
      body: "Mensagens centraliza conversas com famílias e alunos vinculados. Relatórios registra sua devolutiva pedagógica com base no que você realmente acompanhou.",
    },
    {
      selector: 'a[href="/professor/perfil"]',
      title: "Perfil, disponibilidade e ajuda",
      body: "No Perfil você mantém seus dados, matérias, especialidades e horários disponíveis. Sempre que tiver dúvida, use o botão “Como usar” para rever o tour ou explicar a página atual.",
    },
  ],
  guardian: [
    {
      title: "Bem-vindo(a) ao espaço da Família",
      body: "Este tour mostra onde acompanhar a criança, ver atividades, encontros, relatórios e falar com a equipe PLUMARELI. Você pode refazer o tutorial quando quiser.",
    },
    {
      selector: 'a[href="/familia"], a[href^="/familia?"]',
      title: "Visão geral",
      body: "Comece por aqui para ter uma leitura rápida do acompanhamento: atividades recentes, próximos compromissos, avisos e informações importantes da criança selecionada.",
    },
    {
      selector: 'a[href^="/familia/filhos"]',
      title: "Meu filho / Meus filhos",
      body: "Esta área reúne as crianças vinculadas à sua conta. Quando houver mais de uma, você pode escolher de quem deseja visualizar as informações.",
    },
    {
      selector: 'a[href^="/familia/atividades"]',
      title: "Conteúdos e atividades",
      body: "Veja o que foi disponibilizado pelo professor, o que precisa ser feito e o que já foi concluído. O PLUMARELI separa material de consulta de atividades que pedem uma entrega.",
    },
    {
      selector: 'a[href^="/familia/progresso"]',
      title: "Progresso e avaliações",
      body: "Acompanhe a evolução ao longo do tempo e os resultados que já foram liberados. O objetivo é mostrar processo e evidências, não reduzir a criança a uma nota isolada.",
    },
    {
      selector: 'a[href^="/familia/agenda"]',
      title: "Agenda",
      body: "Aqui ficam aulas, revisões e reuniões autorizadas, com data, horário e link quando o compromisso for online.",
    },
    {
      selector: 'a[href^="/familia/mensagens"]',
      title: "Mensagens",
      body: "Use esta área para conversar com o professor ou acompanhar comunicados relacionados à criança vinculada, sem misturar com conversas de outras famílias.",
    },
    {
      selector: 'a[href^="/familia/relatorios"]',
      title: "Relatórios",
      body: "Relatórios publicados pelo professor ficam organizados aqui por aluno e período. Eles registram a devolutiva do acompanhamento realizado.",
    },
    {
      selector: 'a[href^="/familia/plano"]',
      title: "Plano, contrato e pagamentos",
      body: "Consulte as informações administrativas do vínculo, como plano, contrato e pagamentos. Privacidade e autorizações concentra documentos e decisões que precisam da família.",
    },
    {
      selector: 'a[href^="/familia/suporte"]',
      title: "Suporte e perfil",
      body: "Se precisar de ajuda operacional, abra uma solicitação no Suporte. Em Perfil e Configurações você mantém os dados da sua conta atualizados.",
    },
  ],
  student: [
    {
      title: "Bem-vindo(a) ao seu espaço PLUMARELI",
      body: "Aqui você encontra suas missões, agenda, caderno, conquistas e caminhos de aprendizagem. Este tour é curtinho e pode ser repetido quando você quiser.",
    },
    {
      selector: 'a[href="/aluno"]',
      title: "Hoje",
      body: "Esta é sua página de começo. Ela mostra o que está acontecendo agora e ajuda você a escolher o próximo passo sem precisar procurar em várias telas.",
    },
    {
      selector: 'a[href="/aluno/missoes"]',
      title: "Missões",
      body: "As Missões são atividades enviadas para você. Abra uma missão, leia com atenção, responda e acompanhe quando ela for concluída ou revisada.",
    },
    {
      selector: 'a[href="/aluno/agenda"]',
      title: "Agenda",
      body: "Confira seus próximos encontros, aulas e revisões. Quando houver encontro online, o acesso aparece aqui no horário certo.",
    },
    {
      selector: 'a[href="/aluno/caminho"]',
      title: "Caminho",
      body: "O Caminho ajuda a visualizar sua jornada de aprendizagem e os próximos desafios sem transformar uma dificuldade pontual em um rótulo.",
    },
    {
      selector: 'a[href="/aluno/caderno"]',
      title: "Meu Caderno",
      body: "Use o Caderno para produções e atividades que pedem mais construção. Ele funciona como um espaço de trabalho dentro da sua jornada PLUMARELI.",
    },
    {
      selector: 'a[href="/aluno/conquistas"]',
      title: "Conquistas e descobertas",
      body: "Conquistas registra marcos da sua jornada. Descobertas reúne novidades e conteúdos que ajudam você a explorar novos assuntos.",
    },
    {
      selector: 'a[href="/aluno/modo-pensar"]',
      title: "Modo Pensar e Modo Prova",
      body: "Modo Pensar trabalha estratégias de aprendizagem. Modo Prova ajuda a praticar situações de avaliação com organização e autonomia.",
    },
    {
      selector: 'a[href="/aluno/perfil"]',
      title: "Perfil",
      body: "Aqui você vê informações do seu perfil e, quando disponível, escolhe seu personagem PLUMARELI. O botão “Como usar” fica sempre disponível para rever este tutorial.",
    },
  ],
};

const PAGE_GUIDES: Record<TutorialRole, Record<string, PageGuide>> = {
  teacher: {
    "/professor": {
      title: "Hoje",
      purpose: "Seu painel de prioridades do dia. Ele junta o que precisa de atenção antes de você abrir cada módulo.",
      tips: ["Confira correções, mensagens e atividades aguardando aluno.", "Use os atalhos para criar missão, material, avaliação ou agendar encontro."],
    },
    "/professor/agenda": {
      title: "Agenda",
      purpose: "Cria e acompanha aulas, revisões, reuniões com família e outros compromissos.",
      tips: ["Selecione o aluno e preencha data, horário, tipo e situação.", "Adicione link e observações quando necessário e defina quem poderá visualizar o encontro."],
    },
    "/professor/reunioes": {
      title: "Reuniões",
      purpose: "Organiza reuniões com família, aluno ou Administração e concentra o link do Google Meet.",
      tips: ["Escolha o contexto da reunião e quem poderá vê-la.", "Use a lista de próximas reuniões para entrar no encontro sem procurar o link em mensagens antigas."],
    },
    "/professor/alunos": {
      title: "Meus alunos",
      purpose: "Mostra rapidamente quem você acompanha, o progresso observado, pendências e próximos encontros.",
      tips: ["Abra o perfil do aluno para uma leitura mais detalhada.", "Use os indicadores como sinal de acompanhamento, não como diagnóstico isolado."],
    },
    "/professor/limites": {
      title: "Planos e limites",
      purpose: "Mostra os recursos e quantidades disponíveis no ciclo atual de cada aluno.",
      tips: ["Confira encontros, missões, materiais e avaliações antes de programar novas ações.", "Quando o plano for atualizado, esta tela passa a considerar a nova configuração."],
    },
    "/professor/turmas": {
      title: "Turmas",
      purpose: "Exibe as turmas oficiais vinculadas ao professor.",
      tips: ["A turma oficial organiza vínculos de matrícula.", "Grupos pedagógicos são separados e não alteram a turma oficial."],
    },
    "/professor/mapa": {
      title: "Mapa Pedagógico 360°",
      purpose: "Organiza habilidades, evidências, domínio, autonomia, confiança e próximas ações.",
      tips: ["O mapa só ganha força quando existem evidências pedagógicas suficientes.", "Uma dificuldade em uma habilidade não transforma a matéria inteira em dificuldade."],
    },
    "/professor/grupos": {
      title: "Grupos Pedagógicos",
      purpose: "Agrupa necessidades semelhantes para intervenções em conjunto sem mexer na matrícula oficial.",
      tips: ["Use as sugestões do mapa como apoio, não como decisão automática.", "Você decide se um agrupamento pedagógico faz sentido para sua prática."],
    },
    "/professor/criar": {
      title: "Criar conteúdo",
      purpose: "Prepara um rascunho a partir de uma fonte ou abre diretamente um editor final.",
      tips: ["Defina objetivo, habilidade, faixa etária, dificuldade e tipo de questão.", "Revise título, enunciados, alternativas e respostas antes de publicar."],
    },
    "/professor/gerador": {
      title: "Gerador",
      purpose: "Ajuda a estruturar conteúdo pedagógico a partir de uma fonte e de instruções definidas por você.",
      tips: ["Descreva claramente o objetivo e o público da atividade.", "A geração é ponto de partida: revise sempre antes de enviar ao aluno."],
    },
    "/professor/missoes": {
      title: "Missões",
      purpose: "Cria, atribui e acompanha Missões Cuca com questões e gabarito.",
      tips: ["Você pode enviar uma mesma missão para mais de um aluno.", "Antes de publicar, revise questões, respostas, prazo e alunos selecionados."],
    },
    "/professor/materiais": {
      title: "Materiais",
      purpose: "Publica materiais de apoio e Cadernos PLUMARELI para os alunos selecionados.",
      tips: ["Use materiais para consulta e apoio; use atividades quando espera uma entrega.", "Itens programados só aparecem ao aluno no horário definido."],
    },
    "/professor/avaliacoes": {
      title: "Avaliações",
      purpose: "Cria avaliações e acompanha entrega, revisão e resultado na escala definida pelo PLUMARELI.",
      tips: ["Escolha os alunos e confira prazo e conteúdo antes de publicar.", "Use o resultado como uma evidência dentro de um conjunto maior de acompanhamento."],
    },
    "/professor/conteudos": {
      title: "Conteúdos",
      purpose: "Sua biblioteca para localizar e reutilizar Missões, Cadernos, materiais e avaliações.",
      tips: ["Abra um item para revisar ou enviar novamente.", "Duplicar é útil quando você quer adaptar um conteúdo sem perder a versão anterior."],
    },
    "/professor/correcoes": {
      title: "Correções",
      purpose: "Reúne o que precisa de revisão humana: respostas abertas, Cadernos e resultados de avaliações.",
      tips: ["Questões objetivas com gabarito podem ser conferidas automaticamente.", "Respostas abertas e decisões pedagógicas permanecem sob sua revisão."],
    },
    "/professor/mensagens": {
      title: "Mensagens",
      purpose: "Centraliza conversas com famílias e alunos vinculados e separa comunicados administrativos.",
      tips: ["Escolha a conversa correta antes de enviar.", "Use mensagens para comunicação; use Relatórios para devolutivas pedagógicas estruturadas."],
    },
    "/professor/relatorios": {
      title: "Relatórios",
      purpose: "Registra e publica uma devolutiva pedagógica baseada no acompanhamento real do aluno.",
      tips: ["Descreva o que foi trabalhado, evidências observadas, avanços e próximos passos.", "Evite rótulos ou conclusões clínicas; prefira evidências observáveis."],
    },
    "/professor/indicacoes": {
      title: "Indicações",
      purpose: "Acompanha a origem de contatos e matrículas que chegarem pelo seu link quando a campanha estiver ativa.",
      tips: ["O link registra a origem do contato; ele não define sozinho o professor responsável pela matrícula.", "Regras e disponibilidade da campanha aparecem nesta própria tela."],
    },
    "/professor/perfil": {
      title: "Meu perfil",
      purpose: "Mantém seus dados profissionais, foto, matérias, especialidades e disponibilidade semanal.",
      tips: ["Mantenha telefone, descrição e matérias atualizados.", "Cadastre seus horários disponíveis para facilitar a organização de encontros."],
    },
    "/professor/suporte": {
      title: "Suporte PLUMARELI",
      purpose: "Abre solicitações para dúvidas de plataforma, conta, financeiro ou apoio pedagógico.",
      tips: ["Escolha a categoria e a prioridade de acordo com a situação.", "Depois do envio, acompanhe o andamento em Meus tickets."],
    },
  },
  guardian: {
    "/familia": { title: "Visão geral", purpose: "Resume o acompanhamento da criança selecionada em uma única leitura.", tips: ["Confira avisos, atividades e próximos compromissos.", "Se houver mais de uma criança vinculada, confirme qual está selecionada antes de continuar."] },
    "/familia/filhos": { title: "Meu filho / Meus filhos", purpose: "Mostra as crianças vinculadas à sua conta e seus dados principais.", tips: ["Use esta área para navegar entre filhos vinculados.", "Se um vínculo estiver incorreto, use o Suporte em vez de compartilhar acessos."] },
    "/familia/conteudos": { title: "Conteúdos", purpose: "Reúne materiais e conteúdos liberados para a criança.", tips: ["Abra os materiais para consulta quando necessário.", "Conteúdo de apoio não é a mesma coisa que uma atividade com entrega."] },
    "/familia/atividades": { title: "Atividades", purpose: "Mostra missões e tarefas atribuídas, prazos e situação de conclusão.", tips: ["Acompanhe o prazo sem fazer a atividade pela criança.", "Use Mensagens quando precisar esclarecer uma orientação com o professor."] },
    "/familia/progresso": { title: "Progresso", purpose: "Apresenta a evolução observada ao longo do acompanhamento.", tips: ["Leia tendências e evidências ao longo do tempo.", "Um resultado isolado não resume a aprendizagem da criança."] },
    "/familia/avaliacoes": { title: "Avaliações", purpose: "Organiza avaliações liberadas e resultados que já podem ser vistos pela família.", tips: ["Observe também devolutivas e próximos passos.", "Compare o resultado com o processo de aprendizagem, não apenas com uma nota."] },
    "/familia/agenda": { title: "Agenda", purpose: "Mostra aulas, revisões e reuniões da criança, com horário e link quando aplicável.", tips: ["Confirme data e horário antes do encontro.", "O link online fica disponível conforme as regras do compromisso."] },
    "/familia/mensagens": { title: "Mensagens", purpose: "Permite conversar com o professor dentro do vínculo autorizado.", tips: ["Escolha a conversa da criança correta.", "Comunicados administrativos aparecem separados das conversas pedagógicas."] },
    "/familia/relatorios": { title: "Relatórios", purpose: "Guarda as devolutivas pedagógicas publicadas para a família.", tips: ["Leia o período do relatório e as evidências descritas.", "Use o histórico para acompanhar avanços e próximos passos ao longo do tempo."] },
    "/familia/plano": { title: "Plano", purpose: "Apresenta informações do plano ativo e recursos vinculados à criança.", tips: ["Confira o ciclo e as condições exibidas na própria página.", "Para dúvidas administrativas, abra uma solicitação no Suporte."] },
    "/familia/contrato": { title: "Contrato", purpose: "Centraliza documentos contratuais disponibilizados para a família.", tips: ["Leia a versão vigente antes de confirmar qualquer decisão.", "Guarde suas dúvidas para tratar pelo canal de Suporte quando necessário."] },
    "/familia/pagamentos": { title: "Pagamentos", purpose: "Organiza informações financeiras disponibilizadas à família.", tips: ["Confira competência, situação e dados apresentados na tela.", "Se encontrar divergência, use o Suporte e evite enviar dados sensíveis por mensagem comum."] },
    "/familia/indicacoes": { title: "Indique o PLUMARELI", purpose: "Mostra o programa de indicação quando houver campanha ativa para famílias.", tips: ["Leia as regras vigentes antes de compartilhar o link.", "A indicação registra origem e segue as condições exibidas na campanha atual."] },
    "/familia/privacidade": { title: "Privacidade e autorizações", purpose: "Reúne documentos, consentimentos e autorizações relacionados aos dados e à criança.", tips: ["Leia cada documento antes de aceitar ou reconhecer ciência.", "Autorizações opcionais devem permanecer separadas do que é necessário para prestar o serviço."] },
    "/familia/suporte": { title: "Suporte", purpose: "Canal para solicitar ajuda sobre conta, plataforma, financeiro ou acompanhamento.", tips: ["Descreva o problema com clareza e sem incluir dados desnecessários.", "Acompanhe o status do ticket na mesma página."] },
    "/familia/perfil": { title: "Perfil", purpose: "Mantém os dados da conta familiar atualizados.", tips: ["Revise telefone e dados de contato.", "Não compartilhe sua senha ou PIN com terceiros."] },
    "/familia/configuracoes": { title: "Configurações", purpose: "Concentra preferências disponíveis para sua conta familiar.", tips: ["Altere somente o que você reconhece como preferência da sua conta.", "Use o Suporte se uma configuração de acesso estiver diferente do esperado."] },
  },
  student: {
    "/aluno": { title: "Hoje", purpose: "Mostra o que está mais importante para você agora.", tips: ["Comece pelo próximo passo indicado na tela.", "Se algo estiver confuso, peça ajuda antes de responder no chute."] },
    "/aluno/missoes": { title: "Missões", purpose: "Reúne as atividades que foram enviadas para você.", tips: ["Leia todas as orientações antes de começar.", "Quando a questão pedir explicação, mostre seu raciocínio e não apenas a resposta final."] },
    "/aluno/agenda": { title: "Agenda", purpose: "Mostra seus próximos encontros, aulas e revisões.", tips: ["Confira o horário com antecedência.", "Se o encontro for online, use o link que aparecer na própria agenda."] },
    "/aluno/caminho": { title: "Caminho", purpose: "Ajuda você a enxergar sua jornada e os próximos desafios.", tips: ["Avance no seu ritmo e observe o que está ficando mais fácil.", "Uma dificuldade de hoje pode virar uma conquista com prática e estratégia."] },
    "/aluno/perfil": { title: "Perfil", purpose: "Mostra suas informações e opções de personalização disponíveis.", tips: ["Escolha seu personagem quando essa opção estiver liberada.", "Se algum dado pessoal estiver errado, peça ajuda a um responsável ou à equipe PLUMARELI."] },
    "/aluno/caderno": { title: "Meu Caderno", purpose: "Espaço para produções e atividades que pedem construção mais aberta.", tips: ["Organize sua resposta antes de enviar.", "Revise o que escreveu e confira se respondeu ao que foi pedido."] },
    "/aluno/conquistas": { title: "Conquistas", purpose: "Registra marcos da sua jornada dentro do PLUMARELI.", tips: ["Use as conquistas para perceber seu progresso.", "O objetivo não é competir com outras pessoas, e sim acompanhar sua própria evolução."] },
    "/aluno/descobertas": { title: "Descobertas", purpose: "Reúne novidades e conteúdos para explorar novos assuntos.", tips: ["Abra o que despertar curiosidade.", "Anote dúvidas para conversar com seu professor depois."] },
    "/aluno/modo-pensar": { title: "Modo Pensar", purpose: "Trabalha estratégias para aprender, organizar ideias e resolver problemas.", tips: ["Experimente a estratégia proposta antes de decidir se ela funciona para você.", "Preste atenção em como você chegou à resposta, não apenas no resultado."] },
    "/aluno/modo-prova": { title: "Modo Prova", purpose: "Ajuda a praticar situações de avaliação com organização e autonomia.", tips: ["Leia o comando inteiro antes de responder.", "Controle o tempo sem correr: primeiro entenda, depois resolva e por fim revise."] },
  },
};

function storageKey(role: TutorialRole) {
  return `curio:onboarding:v1:${role}`;
}

function sessionKey(role: TutorialRole) {
  return `curio:onboarding:session:v1:${role}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function CurioOnboardingTour({
  role,
  supportHref,
}: {
  role: TutorialRole;
  supportHref?: string;
}) {
  const pathname = usePathname();
  const [introOpen, setIntroOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pageHelpOpen, setPageHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourSteps, setTourSteps] = useState<TourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 1280, height: 800 });

  const currentStep = tourSteps[stepIndex];
  const currentPageGuide = useMemo(() => PAGE_GUIDES[role][pathname] ?? null, [pathname, role]);

  useEffect(() => {
    setMenuOpen(false);
    setPageHelpOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== HOME_PATH[role]) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(storageKey(role))) return;
    if (window.sessionStorage.getItem(sessionKey(role))) return;

    let attempts = 0;
    let timer: number | undefined;
    const tryOpen = () => {
      attempts += 1;
      const anotherDialog = document.querySelector('[role="dialog"], dialog[open]');
      if (anotherDialog && attempts < 5) {
        timer = window.setTimeout(tryOpen, 1200);
        return;
      }
      setIntroOpen(true);
    };
    timer = window.setTimeout(tryOpen, 1200);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [pathname, role]);

  const startTour = useCallback(() => {
    if (typeof document === "undefined") return;
    const available = ROLE_TOURS[role].filter((step) => !step.selector || document.querySelector(step.selector));
    setTourSteps(available);
    setStepIndex(0);
    setTargetRect(null);
    setIntroOpen(false);
    setMenuOpen(false);
    setPageHelpOpen(false);
    setTourOpen(true);
  }, [role]);

  const finishTour = useCallback((status: "completed" | "skipped") => {
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey(role), status);
    setTourOpen(false);
    setTargetRect(null);
    setStepIndex(0);
  }, [role]);

  const refreshTarget = useCallback(() => {
    if (typeof window === "undefined") return;
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    if (!currentStep?.selector) {
      setTargetRect(null);
      return;
    }
    const element = document.querySelector<HTMLElement>(currentStep.selector);
    if (!element) {
      setTargetRect(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [currentStep]);

  useEffect(() => {
    if (!tourOpen || !currentStep) return;
    const element = currentStep.selector ? document.querySelector<HTMLElement>(currentStep.selector) : null;
    element?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const timer = window.setTimeout(refreshTarget, element ? 280 : 0);
    window.addEventListener("resize", refreshTarget);
    window.addEventListener("scroll", refreshTarget, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", refreshTarget);
      window.removeEventListener("scroll", refreshTarget, true);
    };
  }, [currentStep, refreshTarget, tourOpen]);

  const spotlightStyle: CSSProperties | undefined = targetRect
    ? {
        top: Math.max(6, targetRect.top - 7),
        left: Math.max(6, targetRect.left - 7),
        width: Math.max(28, targetRect.width + 14),
        height: Math.max(28, targetRect.height + 14),
      }
    : undefined;

  const tourCardStyle = useMemo<CSSProperties>(() => {
    if (!targetRect || viewport.width <= 760) {
      return { left: 14, right: 14, bottom: 14 };
    }
    const cardWidth = 380;
    const estimatedHeight = 260;
    let left = targetRect.left + targetRect.width + 18;
    if (left + cardWidth > viewport.width - 16) left = targetRect.left - cardWidth - 18;
    left = clamp(left, 16, Math.max(16, viewport.width - cardWidth - 16));
    const top = clamp(targetRect.top, 16, Math.max(16, viewport.height - estimatedHeight - 16));
    return { left, top, width: cardWidth };
  }, [targetRect, viewport]);

  const dismissForSession = () => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(sessionKey(role), "later");
    setIntroOpen(false);
  };

  const disableAutomaticIntro = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey(role), "disabled");
    setIntroOpen(false);
    setMenuOpen(false);
  };

  return (
    <>
      <div className={styles.launcherWrap}>
        {menuOpen ? (
          <div className={styles.helpMenu} role="menu" aria-label="Ajuda de uso do PLUMARELI">
            <strong>Como usar o PLUMARELI</strong>
            <button type="button" role="menuitem" onClick={startTour}>Fazer tour do {ROLE_NAME[role]}</button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setPageHelpOpen(true); }}>Explicar esta página</button>
            {supportHref ? <a role="menuitem" href={supportHref}>Falar com o suporte</a> : null}
            <button type="button" role="menuitem" className={styles.mutedAction} onClick={disableAutomaticIntro}>Não mostrar automaticamente</button>
          </div>
        ) : null}
        <button
          type="button"
          className={styles.launcher}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span aria-hidden="true">?</span>
          <strong>Como usar</strong>
        </button>
      </div>

      {introOpen ? (
        <div className={styles.modalBackdrop}>
          <section className={styles.introCard} role="dialog" aria-modal="true" aria-labelledby="curio-onboarding-title">
            <div className={styles.badge}>Primeiro acesso</div>
            <h2 id="curio-onboarding-title">Quer conhecer seu espaço no PLUMARELI?</h2>
            <p>Em poucos passos mostramos onde encontrar o essencial. O tutorial não altera nenhum dado e você pode interromper quando quiser.</p>
            <div className={styles.introActions}>
              <button type="button" className={styles.primaryButton} onClick={startTour}>Começar tour</button>
              <button type="button" className={styles.secondaryButton} onClick={dismissForSession}>Agora não</button>
            </div>
            <button type="button" className={styles.textButton} onClick={disableAutomaticIntro}>Não mostrar novamente</button>
          </section>
        </div>
      ) : null}

      {pageHelpOpen ? (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setPageHelpOpen(false); }}>
          <section className={styles.pageHelpCard} role="dialog" aria-modal="true" aria-labelledby="curio-page-help-title">
            <div className={styles.pageHelpHead}>
              <div>
                <div className={styles.badge}>Ajuda desta página</div>
                <h2 id="curio-page-help-title">{currentPageGuide?.title ?? "Como usar esta página"}</h2>
              </div>
              <button type="button" className={styles.closeButton} aria-label="Fechar ajuda" onClick={() => setPageHelpOpen(false)}>×</button>
            </div>
            <p>{currentPageGuide?.purpose ?? "Use o título e a descrição no topo como orientação principal. Os cartões e formulários abaixo organizam as ações disponíveis nesta área."}</p>
            <div className={styles.tipBox}>
              <strong>Para usar bem esta área:</strong>
              <ul>
                {(currentPageGuide?.tips ?? ["Leia o contexto no topo antes de preencher ou publicar algo.", "Quando houver uma ação de envio ou publicação, revise as informações antes de confirmar."]).map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            </div>
            <div className={styles.pageHelpActions}>
              <button type="button" className={styles.primaryButton} onClick={() => { setPageHelpOpen(false); startTour(); }}>Ver tour completo</button>
              {supportHref ? <a className={styles.secondaryLink} href={supportHref}>Abrir suporte</a> : null}
            </div>
          </section>
        </div>
      ) : null}

      {tourOpen && currentStep ? (
        <div className={styles.tourLayer} aria-live="polite">
          {targetRect ? <div className={styles.spotlight} style={spotlightStyle} aria-hidden="true" /> : <div className={styles.fullShade} aria-hidden="true" />}
          <section className={styles.tourCard} style={tourCardStyle} role="dialog" aria-modal="true" aria-labelledby="curio-tour-step-title">
            <div className={styles.progressRow}>
              <span>{stepIndex + 1} de {tourSteps.length}</span>
              <button type="button" onClick={() => finishTour("skipped")}>Pular tutorial</button>
            </div>
            <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${((stepIndex + 1) / tourSteps.length) * 100}%` }} /></div>
            <h2 id="curio-tour-step-title">{currentStep.title}</h2>
            <p>{currentStep.body}</p>
            <div className={styles.tourActions}>
              <button type="button" className={styles.secondaryButton} disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}>Anterior</button>
              {stepIndex === tourSteps.length - 1 ? (
                <button type="button" className={styles.primaryButton} onClick={() => finishTour("completed")}>Concluir</button>
              ) : (
                <button type="button" className={styles.primaryButton} onClick={() => setStepIndex((index) => Math.min(tourSteps.length - 1, index + 1))}>Próximo</button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
