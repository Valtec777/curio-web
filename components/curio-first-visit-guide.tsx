"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CurioOnboardingTour } from "@/components/curio-onboarding-tour";
import styles from "./curio-first-visit-guide.module.css";

type TutorialRole = "teacher" | "guardian" | "student";

type QuickGuide = {
  title: string;
  purpose: string;
  steps: string[];
};

const HOME_PATH: Record<TutorialRole, string> = {
  teacher: "/professor",
  guardian: "/familia",
  student: "/aluno",
};

const QUICK_GUIDES: Record<TutorialRole, Record<string, QuickGuide>> = {
  teacher: {
    "/professor": { title: "Hoje", purpose: "Sua central de prioridades do dia.", steps: ["Veja aulas, correções, mensagens e pendências.", "Use os atalhos para começar a próxima ação."] },
    "/professor/agenda": { title: "Agenda", purpose: "Organiza aulas, revisões e outros compromissos.", steps: ["Escolha aluno, tipo, data e horário.", "Inclua link, observações e quem poderá visualizar."] },
    "/professor/reunioes": { title: "Reuniões", purpose: "Organiza conversas com família, aluno ou Administração.", steps: ["Defina contexto, horário e duração.", "Cadastre o link do encontro e os participantes autorizados."] },
    "/professor/alunos": { title: "Meus alunos", purpose: "Mostra rapidamente quem você acompanha e o que merece atenção.", steps: ["Confira progresso, pendências e próximo encontro.", "Abra o aluno para ver o acompanhamento completo."] },
    "/professor/limites": { title: "Planos e limites", purpose: "Mostra o que cada aluno ainda tem disponível no ciclo atual.", steps: ["Confira os recursos antes de programar novas ações.", "Use a Agenda quando houver encontros disponíveis."] },
    "/professor/turmas": { title: "Turmas", purpose: "Mostra as turmas oficiais vinculadas a você.", steps: ["Use a turma para entender os vínculos oficiais.", "Grupos Pedagógicos não alteram a matrícula."] },
    "/professor/mapa": { title: "Mapa Pedagógico", purpose: "Organiza habilidades e evidências do acompanhamento.", steps: ["Observe tendências com evidências suficientes.", "Use o mapa para decidir próximos passos, sem transformar um sinal isolado em diagnóstico."] },
    "/professor/grupos": { title: "Grupos Pedagógicos", purpose: "Agrupa necessidades semelhantes para intervenções em conjunto.", steps: ["Revise as necessidades encontradas.", "Você decide se o agrupamento sugerido faz sentido."] },
    "/professor/criar": { title: "Criar conteúdo", purpose: "Prepara um rascunho a partir de texto, arquivo ou instruções.", steps: ["Defina objetivo, habilidade, faixa etária e formato.", "Revise tudo antes de levar ao editor final ou publicar."] },
    "/professor/gerador": { title: "Gerador", purpose: "Ajuda a estruturar conteúdo pedagógico a partir de uma fonte.", steps: ["Explique claramente o objetivo e o público.", "Trate a geração como rascunho e revise antes do envio."] },
    "/professor/missoes": { title: "Missões", purpose: "Cria, envia e acompanha Missões Cuca.", steps: ["Revise questões, respostas e prazo.", "Escolha os alunos antes de enviar ou atualizar a missão."] },
    "/professor/materiais": { title: "Materiais", purpose: "Publica materiais de apoio e Cadernos CURIÓ.", steps: ["Crie ou selecione o material.", "Defina alunos e, quando necessário, data de liberação."] },
    "/professor/avaliacoes": { title: "Avaliações", purpose: "Cria avaliações e acompanha entrega, revisão e resultado.", steps: ["Defina conteúdo, alunos e prazo.", "Use o resultado como uma evidência dentro do acompanhamento."] },
    "/professor/conteudos": { title: "Conteúdos", purpose: "Sua biblioteca de Missões, Cadernos, materiais e avaliações.", steps: ["Abra um conteúdo para revisar ou enviar novamente.", "Duplique quando quiser adaptar sem perder a versão anterior."] },
    "/professor/correcoes": { title: "Correções", purpose: "Reúne respostas e produções que precisam da sua revisão.", steps: ["Abra o item pendente e confira a evidência enviada.", "Registre a decisão pedagógica e a devolutiva quando necessário."] },
    "/professor/mensagens": { title: "Mensagens", purpose: "Centraliza conversas com famílias e alunos vinculados.", steps: ["Escolha a conversa correta.", "Use Relatórios quando a devolutiva precisar ficar registrada de forma estruturada."] },
    "/professor/relatorios": { title: "Relatórios", purpose: "Registra a devolutiva pedagógica do acompanhamento real.", steps: ["Selecione aluno e período.", "Descreva evidências, avanços e próximos passos antes de publicar para a família."] },
    "/professor/indicacoes": { title: "Indicações", purpose: "Acompanha contatos e matrículas originados pelo seu link quando a campanha estiver ativa.", steps: ["Leia as regras exibidas na própria página.", "Acompanhe a origem dos contatos e matrículas confirmadas."] },
    "/professor/perfil": { title: "Meu perfil", purpose: "Mantém seus dados profissionais e sua disponibilidade atualizados.", steps: ["Revise contato, matérias e especialidades.", "Cadastre os horários em que você pode atender."] },
    "/professor/suporte": { title: "Suporte CURIÓ", purpose: "Canal para dúvidas de plataforma, conta, financeiro ou apoio pedagógico.", steps: ["Escolha categoria e prioridade.", "Descreva a situação e acompanhe o ticket nesta mesma página."] },
  },
  guardian: {
    "/familia": { title: "Visão geral", purpose: "Resume o acompanhamento da criança selecionada.", steps: ["Confira avisos, atividades e compromissos.", "Se houver mais de uma criança, confirme quem está selecionado."] },
    "/familia/filhos": { title: "Meu filho / Meus filhos", purpose: "Mostra as crianças vinculadas à sua conta.", steps: ["Escolha a criança que deseja acompanhar.", "Use o Suporte se algum vínculo estiver incorreto."] },
    "/familia/conteudos": { title: "Conteúdos", purpose: "Reúne materiais liberados para consulta.", steps: ["Abra o material desejado.", "Atividades com entrega ficam em uma área separada."] },
    "/familia/atividades": { title: "Atividades", purpose: "Mostra tarefas, missões, prazos e situação de conclusão.", steps: ["Confira o que foi solicitado e o prazo.", "Acompanhe sem fazer a atividade pela criança."] },
    "/familia/progresso": { title: "Progresso", purpose: "Apresenta a evolução observada ao longo do acompanhamento.", steps: ["Observe o processo e as evidências ao longo do tempo.", "Evite interpretar um resultado isolado como resumo da aprendizagem."] },
    "/familia/avaliacoes": { title: "Avaliações", purpose: "Organiza avaliações e resultados já liberados.", steps: ["Veja a avaliação e a devolutiva disponível.", "Leia o resultado junto com o restante do acompanhamento."] },
    "/familia/agenda": { title: "Agenda", purpose: "Mostra aulas, revisões e reuniões da criança.", steps: ["Confira data e horário.", "Use o link da própria agenda quando o encontro for online."] },
    "/familia/mensagens": { title: "Mensagens", purpose: "Permite conversar com o professor dentro do vínculo autorizado.", steps: ["Escolha a conversa da criança correta.", "Comunicados administrativos aparecem separados."] },
    "/familia/relatorios": { title: "Relatórios", purpose: "Guarda devolutivas pedagógicas publicadas para a família.", steps: ["Confira aluno e período.", "Leia evidências, avanços e próximos passos descritos pelo professor."] },
    "/familia/plano": { title: "Plano", purpose: "Mostra informações do plano ativo e dos recursos vinculados.", steps: ["Confira ciclo e condições exibidas.", "Use o Suporte em caso de dúvida administrativa."] },
    "/familia/contrato": { title: "Contrato", purpose: "Centraliza documentos contratuais disponibilizados à família.", steps: ["Leia a versão vigente.", "Use o Suporte para esclarecer dúvidas antes de decisões importantes."] },
    "/familia/pagamentos": { title: "Pagamentos", purpose: "Organiza as informações financeiras disponibilizadas à família.", steps: ["Confira competência e situação.", "Em caso de divergência, abra um ticket no Suporte."] },
    "/familia/indicacoes": { title: "Indique o CURIÓ", purpose: "Mostra o programa de indicação quando houver campanha ativa.", steps: ["Leia as regras vigentes.", "Compartilhe o link somente quando a campanha estiver liberada."] },
    "/familia/privacidade": { title: "Privacidade e autorizações", purpose: "Reúne documentos, consentimentos e autorizações.", steps: ["Leia cada documento antes de decidir.", "Revise autorizações opcionais separadamente."] },
    "/familia/suporte": { title: "Suporte", purpose: "Canal de ajuda para conta, plataforma, financeiro ou acompanhamento.", steps: ["Explique a situação com clareza.", "Acompanhe o status do ticket nesta mesma página."] },
    "/familia/perfil": { title: "Perfil", purpose: "Mantém os dados da conta familiar atualizados.", steps: ["Revise telefone e contato.", "Não compartilhe senha ou PIN com terceiros."] },
    "/familia/configuracoes": { title: "Configurações", purpose: "Concentra preferências disponíveis para a conta familiar.", steps: ["Revise as opções antes de alterar.", "Procure o Suporte se algo de acesso estiver diferente do esperado."] },
  },
  student: {
    "/aluno": { title: "Hoje", purpose: "Mostra o que está mais importante para você agora.", steps: ["Comece pelo próximo passo indicado.", "Se algo estiver confuso, peça ajuda antes de responder."] },
    "/aluno/missoes": { title: "Missões", purpose: "Reúne as atividades enviadas para você.", steps: ["Leia todas as orientações.", "Responda com atenção e mostre seu raciocínio quando a questão pedir."] },
    "/aluno/agenda": { title: "Agenda", purpose: "Mostra seus próximos encontros, aulas e revisões.", steps: ["Confira o horário com antecedência.", "Use o link que aparecer na agenda quando o encontro for online."] },
    "/aluno/caminho": { title: "Caminho", purpose: "Ajuda você a enxergar sua jornada e os próximos desafios.", steps: ["Observe o que já avançou.", "Use os próximos passos como orientação, não como rótulo."] },
    "/aluno/perfil": { title: "Perfil", purpose: "Mostra suas informações e opções de personalização.", steps: ["Escolha seu personagem quando a opção estiver disponível.", "Peça ajuda se algum dado estiver incorreto."] },
    "/aluno/caderno": { title: "Meu Caderno", purpose: "Espaço para produções e atividades mais abertas.", steps: ["Organize sua resposta.", "Revise antes de enviar."] },
    "/aluno/conquistas": { title: "Conquistas", purpose: "Registra marcos da sua jornada no CURIÓ.", steps: ["Veja o que você já alcançou.", "Compare sua evolução com você mesmo, não com outras pessoas."] },
    "/aluno/descobertas": { title: "Descobertas", purpose: "Reúne novidades e conteúdos para explorar.", steps: ["Abra o que despertar curiosidade.", "Guarde suas dúvidas para conversar com o professor."] },
    "/aluno/modo-pensar": { title: "Modo Pensar", purpose: "Trabalha estratégias para aprender e resolver problemas.", steps: ["Experimente a estratégia proposta.", "Observe como você chegou à resposta, não apenas o resultado."] },
    "/aluno/modo-prova": { title: "Modo Prova", purpose: "Ajuda a praticar situações de avaliação com organização.", steps: ["Leia o comando inteiro.", "Resolva com calma e deixe um tempo para revisar."] },
  },
};

function entryKey(role: TutorialRole, viewerId: string) {
  return `curio:onboarding:entry:v2:${role}:${viewerId}`;
}

function pageKey(role: TutorialRole, viewerId: string, pathname: string) {
  return `curio:onboarding:page:v2:${role}:${viewerId}:${pathname}`;
}

function legacyStorageKey(role: TutorialRole) {
  return `curio:onboarding:v1:${role}`;
}

function legacySessionKey(role: TutorialRole) {
  return `curio:onboarding:session:v1:${role}`;
}

export function CurioFirstVisitGuide({
  role,
  viewerId,
  supportHref,
}: {
  role: TutorialRole;
  viewerId: string;
  supportHref?: string;
}) {
  const pathname = usePathname();
  const guide = useMemo(() => QUICK_GUIDES[role][pathname] ?? null, [pathname, role]);
  const [tourReady, setTourReady] = useState(false);
  const [firstVisitOpen, setFirstVisitOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setTourReady(false);
    setFirstVisitOpen(false);

    const isHome = pathname === HOME_PATH[role];
    const userEntryKey = entryKey(role, viewerId);
    const hasEnteredBefore = window.localStorage.getItem(userEntryKey) === "seen";

    if (!hasEnteredBefore && isHome) {
      // A chave antiga não identificava o usuário. Limpamos somente no primeiro
      // acesso deste usuário para que o convite inicial apareça uma única vez.
      window.localStorage.removeItem(legacyStorageKey(role));
      window.sessionStorage.removeItem(legacySessionKey(role));
      window.localStorage.setItem(userEntryKey, "seen");
      window.localStorage.setItem(pageKey(role, viewerId, pathname), "seen");
    } else if (hasEnteredBefore && !window.localStorage.getItem(legacyStorageKey(role))) {
      // Se a pessoa escolheu "Agora não" no primeiro acesso, não insistimos
      // em logins futuros. O tour continua disponível manualmente em Como usar.
      window.localStorage.setItem(legacyStorageKey(role), "entry-seen");
    }

    setTourReady(true);

    if (!guide || isHome) return;

    const currentPageKey = pageKey(role, viewerId, pathname);
    if (window.localStorage.getItem(currentPageKey) === "seen") return;

    // Marcamos assim que a primeira ajuda é programada para que atualizar a
    // página ou voltar depois não faça o cartão reaparecer automaticamente.
    window.localStorage.setItem(currentPageKey, "seen");

    let attempts = 0;
    let timer: number | undefined;
    const tryOpen = () => {
      attempts += 1;
      const anotherDialog = document.querySelector('[role="dialog"], dialog[open]');
      if (anotherDialog && attempts < 6) {
        timer = window.setTimeout(tryOpen, 1100);
        return;
      }
      setFirstVisitOpen(true);
    };

    timer = window.setTimeout(tryOpen, 850);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [guide, pathname, role, viewerId]);

  return (
    <>
      {tourReady ? <CurioOnboardingTour role={role} supportHref={supportHref} /> : null}

      {firstVisitOpen && guide ? (
        <div
          className={styles.backdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFirstVisitOpen(false);
          }}
        >
          <section className={styles.card} role="dialog" aria-modal="true" aria-labelledby="curio-first-visit-title">
            <div className={styles.head}>
              <div>
                <span className={styles.badge}>Primeira vez nesta página</span>
                <h2 id="curio-first-visit-title">{guide.title}</h2>
              </div>
              <button type="button" className={styles.close} aria-label="Fechar" onClick={() => setFirstVisitOpen(false)}>×</button>
            </div>
            <p className={styles.purpose}>{guide.purpose}</p>
            <ol className={styles.steps}>
              {guide.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => setFirstVisitOpen(false)}>Entendi</button>
              <span>Você não verá esta explicação automaticamente de novo. Se precisar, use <strong>Como usar</strong>.</span>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
