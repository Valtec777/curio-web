type IconName =
  | "home" | "sparkles" | "lock" | "user" | "users" | "link" | "grid" | "chart"
  | "alert" | "palette" | "book" | "rocket" | "layers" | "calendar" | "wallet"
  | "diamond" | "message" | "help" | "file" | "mail" | "list" | "trash" | "settings"
  | "shield" | "activity" | "map" | "star" | "notebook" | "check" | "trophy" | "search"
  | "brain" | "school" | "archive" | "edit" | "camera";

const labelIcons: Record<string, IconName> = {
  "Hoje": "home",
  "Administração": "shield",
  "Professor": "user",
  "Modo Criança": "star",
  "Ninho da Família": "users",
  "Visão geral": "home",
  "Matrículas": "sparkles",
  "Usuários e acessos": "lock",
  "Alunos": "user",
  "Meu filho / Meus filhos": "users",
  "Famílias": "users",
  "Professores": "user",
  "Vínculos": "link",
  "Turmas": "school",
  "Mapa Pedagógico": "chart",
  "Grupos Pedagógicos": "users",
  "Missões": "star",
  "Missões e atividades": "star",
  "Materiais": "book",
  "Galeria de Materiais": "book",
  "Gerador": "rocket",
  "Conteúdo": "palette",
  "Conteúdos": "palette",
  "Correções": "check",
  "Avaliações": "activity",
  "Relatórios": "chart",
  "Relatórios Acadêmicos": "chart",
  "Ocorrências": "alert",
  "Configuração de Notas": "activity",
  "Séries": "layers",
  "Modelos": "grid",
  "Agenda": "calendar",
  "Calendário Escolar": "calendar",
  "Financeiro": "wallet",
  "Planos": "diamond",
  "Pagamentos": "wallet",
  "Mensagens": "message",
  "Suporte": "help",
  "Suporte e Tickets": "help",
  "Documentos": "file",
  "Comunicação": "mail",
  "Listas": "list",
  "Gestão de Mascotes": "sparkles",
  "Biblioteca de Mídia": "camera",
  "Auditoria": "shield",
  "Monitoramento de Acesso": "activity",
  "Lixeira": "trash",
  "Configurações": "settings",
  "Perfil": "user",
  "Plano": "diamond",
  "Contrato": "file",
  "Caminho": "map",
  "Meu Caderno": "notebook",
  "Conquistas": "trophy",
  "Descobertas": "search",
  "Modo Pensar": "brain",
  "Modo Pensar · Cursos": "book",
  "Cursos Livres": "book",
  "Modo Prova": "check",
  "Área Administrativa": "settings",
  "Trocar ambiente": "link",
  "Voltar à família": "lock",
};

function Paths({ name }: { name: IconName }) {
  switch (name) {
    case "home": return <><path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></>;
    case "sparkles": return <><path d="m12 2 1.2 4.2L17 8l-3.8 1.8L12 14l-1.2-4.2L7 8l3.8-1.8L12 2Z"/><path d="m5 13 .8 2.7L8.5 17l-2.7 1.3L5 21l-.8-2.7L1.5 17l2.7-1.3L5 13Z"/><path d="m19 13 .6 2 1.9 1-1.9.9L19 19l-.6-2.1-1.9-.9 1.9-1 .6-2Z"/></>;
    case "lock": return <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></>;
    case "user": return <><circle cx="12" cy="7" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>;
    case "users": return <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3 3 0 0 1 0 5.5"/><path d="M17 14.5a5.5 5.5 0 0 1 4.5 5.5"/></>;
    case "link": return <><path d="M10 13a4.5 4.5 0 0 0 6.4.1l2.5-2.5a4.5 4.5 0 0 0-6.4-6.4L11 5.7"/><path d="M14 11a4.5 4.5 0 0 0-6.4-.1l-2.5 2.5a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5"/></>;
    case "grid": return <><rect x="3" y="4" width="8" height="6" rx="1"/><rect x="13" y="4" width="8" height="6" rx="1"/><rect x="3" y="14" width="8" height="6" rx="1"/><rect x="13" y="14" width="8" height="6" rx="1"/></>;
    case "chart": return <><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></>;
    case "alert": return <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/></>;
    case "palette": return <><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h4a5 5 0 0 0 5-5c0-3-4-5-9-5Z"/><circle cx="7" cy="9" r="1"/><circle cx="10" cy="6" r="1"/><circle cx="15" cy="7" r="1"/></>;
    case "book": return <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/></>;
    case "rocket": return <><path d="M14 4c3-2 6-1 6-1s1 3-1 6l-6.5 6.5-4-4L14 4Z"/><path d="m8.5 11.5-4 .5-2 2 5 1"/><path d="m12.5 15.5-.5 4-2 2-1-5"/><circle cx="16" cy="7" r="1.5"/></>;
    case "layers": return <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></>;
    case "calendar": return <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h2M14 14h2M8 18h2"/></>;
    case "wallet": return <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z"/><path d="M16 9h5v6h-5a3 3 0 0 1 0-6Z"/><circle cx="17" cy="12" r=".7"/></>;
    case "diamond": return <><path d="m12 2 8 6-8 14L4 8l8-6Z"/><path d="M4 8h16M8 3.8 10 8l2 14 2-14 2-4.2"/></>;
    case "message": return <><path d="M4 4h16v13H9l-5 4V4Z"/><path d="M8 9h8M8 13h5"/></>;
    case "help": return <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 4.3 1.7c-1.2 1-2 1.5-2 3.3"/><path d="M12 17.5h.01"/></>;
    case "file": return <><path d="M6 2h8l4 4v16H6V2Z"/><path d="M14 2v5h5"/><path d="M9 12h6M9 16h6"/></>;
    case "mail": return <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>;
    case "list": return <><path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>;
    case "trash": return <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/><path d="M10 11v6M14 11v6"/></>;
    case "settings": return <><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2.2-.6a7 7 0 0 0-.8-1.8L17.2 6 15 3.8 12.9 5a7 7 0 0 0-1.8-.8L10.5 2h-3L7 4.2a7 7 0 0 0-1.8.8L3 3.8.8 6 2 8.1a7 7 0 0 0-.8 1.8L-1 10.5v3l2.2.6a7 7 0 0 0 .8 1.8L.8 18 3 20.2 5.2 19a7 7 0 0 0 1.8.8l.5 2.2h3l.6-2.2a7 7 0 0 0 1.8-.8l2.1 1.2 2.2-2.2-1.2-2.1a7 7 0 0 0 .8-1.8l2.2-.6Z" transform="translate(2.5 0) scale(.8)"/></>;
    case "shield": return <><path d="M12 2 20 5v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>;
    case "activity": return <><path d="M3 12h4l2-5 4 10 2-5h6"/></>;
    case "map": return <><path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Z"/><path d="M9 2v17M15 5v17"/></>;
    case "star": return <path d="m12 2.5 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.1l6.2-.9L12 2.5Z"/>;
    case "notebook": return <><rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18M3 7h4M3 12h4M3 17h4"/></>;
    case "check": return <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/></>;
    case "trophy": return <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/></>;
    case "search": return <><circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6"/></>;
    case "brain": return <><path d="M9 4a3 3 0 0 0-5 2.2A3.5 3.5 0 0 0 4 13a3 3 0 0 0 5 3V4Z"/><path d="M15 4a3 3 0 0 1 5 2.2A3.5 3.5 0 0 1 20 13a3 3 0 0 1-5 3V4Z"/><path d="M9 8H7M15 8h2M9 13H7M15 13h2M12 4v16"/></>;
    case "school": return <><path d="M3 10 12 4l9 6-9 6-9-6Z"/><path d="M6 13v5h12v-5M21 10v6"/></>;
    case "archive": return <><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M9 13h6"/></>;
    case "edit": return <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>;
    case "camera": return <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 6 1.5-2h5L16 6"/><circle cx="12" cy="13" r="4"/></>;
  }
}

export function NavIcon({ label }: { label: string }) {
  const name = labelIcons[label] || "grid";
  return (
    <svg className="nav-icon-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <Paths name={name} />
    </svg>
  );
}
