export type SeasonalBand = "1-3" | "4-5" | "6-8";

export type SeasonalEvent = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  decorations: string[];
  fixedWindow?: { start: number; end: number };
  mission: Record<SeasonalBand, string>;
};

const events: SeasonalEvent[] = [
  {
    slug: "reveillon",
    title: "Virada Curió",
    eyebrow: "Réveillon",
    description: "Uma pausa para reconhecer conquistas, organizar ideias e escolher um próximo passo possível.",
    decorations: ["✨", "🎆", "⭐", "🥳", "✨"],
    fixedWindow: { start: 1228, end: 102 },
    mission: {
      "1-3": "Desenhe três coisas que você aprendeu neste ano e escolha uma curiosidade para investigar no próximo.",
      "4-5": "Monte uma retrospectiva com três aprendizados, um desafio superado e uma meta de estudo que possa ser medida.",
      "6-8": "Faça um balanço do ano: evidência de evolução, estratégia que funcionou, hábito que precisa mudar e uma meta com prazo.",
    },
  },
  {
    slug: "natal",
    title: "Natal de ideias que fazem bem",
    eyebrow: "Natal",
    description: "Gratidão, planejamento e criatividade em uma atividade leve para encerrar o ano.",
    decorations: ["🎄", "⭐", "🎁", "❄️", "🎄"],
    fixedWindow: { start: 1218, end: 1226 },
    mission: {
      "1-3": "Crie um cartão ilustrado agradecendo alguém por algo que você aprendeu com essa pessoa e escreva uma frase completa.",
      "4-5": "Planeje uma pequena ação de gentileza usando orçamento fictício de R$ 50 e explique como dividiria esse valor.",
      "6-8": "Crie uma campanha de fim de ano com mensagem, público, orçamento fictício e justificativa das escolhas.",
    },
  },
  {
    slug: "consciencia-negra",
    title: "Vozes que fizeram o Brasil",
    eyebrow: "Consciência Negra",
    description: "Uma proposta para conhecer trajetórias, contribuições e fontes históricas sem reduzir a história negra à escravidão.",
    decorations: ["📚", "🎨", "🎵", "🌍", "📚"],
    fixedWindow: { start: 1118, end: 1122 },
    mission: {
      "1-3": "Conheça uma personalidade negra brasileira e conte, com desenho e frases curtas, o que ela criou, defendeu ou transformou.",
      "4-5": "Escolha duas personalidades negras brasileiras de áreas diferentes e compare suas contribuições usando pelo menos duas fontes.",
      "6-8": "Analise duas fontes sobre uma personalidade ou movimento negro brasileiro, diferencie fato de opinião e registre o que cada fonte acrescenta.",
    },
  },
  {
    slug: "halloween",
    title: "Laboratório do mistério",
    eyebrow: "Halloween",
    description: "Pistas, lógica e criatividade em um desafio sem sustos pesados e adequado ao ambiente escolar.",
    decorations: ["🎃", "🔎", "🦇", "🧩", "🎃"],
    fixedWindow: { start: 1027, end: 1101 },
    mission: {
      "1-3": "Resolva um mistério simples criando três pistas em ordem e uma explicação para a resposta.",
      "4-5": "Crie um enigma com sequência lógica, pista falsa e solução explicada passo a passo.",
      "6-8": "Monte um mini caso investigativo com dados, duas hipóteses e uma conclusão sustentada pelas evidências.",
    },
  },
  {
    slug: "criancas",
    title: "Festival da curiosidade",
    eyebrow: "Dia das Crianças",
    description: "Uma missão para celebrar brincar, perguntar, criar e descobrir — sem transformar a data em obrigação escolar.",
    decorations: ["🎈", "🪁", "✨", "🎨", "🎈"],
    fixedWindow: { start: 1008, end: 1013 },
    mission: {
      "1-3": "Escolha uma pergunta curiosa sobre o mundo, desenhe o que você imagina e depois descubra uma resposta em fonte segura.",
      "4-5": "Transforme uma brincadeira em investigação: crie uma pergunta, faça um pequeno teste e registre o resultado.",
      "6-8": "Escolha um tema que você realmente goste e produza uma explicação curta para alguém mais novo, usando exemplo e comparação.",
    },
  },
  {
    slug: "independencia",
    title: "Arquivo 1822",
    eyebrow: "Independência do Brasil",
    description: "Uma missão especial para investigar o 7 de Setembro com linha do tempo, fontes e diferentes pontos de vista.",
    decorations: ["🇧🇷", "📜", "🔎", "🗺️", "🇧🇷"],
    fixedWindow: { start: 904, end: 909 },
    mission: {
      "1-3": "Monte uma linha do tempo ilustrada com três momentos: antes, durante e depois de 7 de setembro de 1822. Explique cada quadro com uma frase.",
      "4-5": "Compare duas representações da Independência do Brasil e liste o que aparece, o que não aparece e quais perguntas ficaram.",
      "6-8": "Investigue a pergunta 'independência para quem?': compare pelo menos duas fontes, identifique contexto e escreva uma conclusão baseada em evidências.",
    },
  },
  {
    slug: "folclore",
    title: "Mapa vivo do folclore brasileiro",
    eyebrow: "Folclore Brasileiro",
    description: "Narrativas, festas, música e saberes de diferentes regiões do país em uma investigação cultural.",
    decorations: ["📖", "🌿", "🎭", "🗺️", "📖"],
    fixedWindow: { start: 819, end: 824 },
    mission: {
      "1-3": "Escolha uma lenda brasileira, reconte com suas palavras e marque no mapa a região onde ela é conhecida.",
      "4-5": "Compare duas manifestações do folclore de regiões diferentes e registre semelhanças, diferenças e fontes consultadas.",
      "6-8": "Investigue como uma manifestação cultural muda entre regiões ou ao longo do tempo e explique por que tradição não significa algo parado.",
    },
  },
  {
    slug: "festa-junina",
    title: "Arraiá dos números e histórias",
    eyebrow: "Festas Juninas",
    description: "Matemática, linguagem e cultura popular em uma proposta que pode ser feita com materiais simples.",
    decorations: ["🎏", "🌽", "🎶", "🔥", "🎏"],
    fixedWindow: { start: 613, end: 630 },
    mission: {
      "1-3": "Monte uma barraca fictícia com três itens, preços inteiros e contas simples de compra e troco.",
      "4-5": "Planeje um pequeno arraiá fictício com orçamento, tabela de gastos e uma explicação sobre uma tradição pesquisada.",
      "6-8": "Crie um orçamento proporcional para um evento fictício e investigue a origem de uma tradição junina usando duas fontes.",
    },
  },
  {
    slug: "meio-ambiente",
    title: "Eco-investigação Curió",
    eyebrow: "Dia do Meio Ambiente",
    description: "Observar, medir e propor uma ação pequena e verificável para o lugar onde o estudante vive.",
    decorations: ["🌱", "💧", "🌎", "🔎", "🌱"],
    fixedWindow: { start: 603, end: 607 },
    mission: {
      "1-3": "Observe por um dia onde há desperdício de água ou energia e faça um desenho com uma solução possível.",
      "4-5": "Registre durante dois dias um tipo de consumo ou descarte em casa e proponha uma mudança que possa ser medida.",
      "6-8": "Colete uma pequena amostra de dados sobre consumo, resíduos ou mobilidade e escreva uma proposta com indicador para verificar se funcionou.",
    },
  },
  {
    slug: "trabalho-profissoes",
    title: "Profissões que resolvem problemas",
    eyebrow: "Trabalho e profissões",
    description: "Uma investigação sobre o que diferentes profissionais fazem, quais problemas resolvem e que conhecimentos usam.",
    decorations: ["🧰", "🧠", "🩺", "🏗️", "🧰"],
    fixedWindow: { start: 429, end: 502 },
    mission: {
      "1-3": "Escolha uma profissão, desenhe uma situação em que ela ajuda alguém e escreva três coisas que essa pessoa precisa saber fazer.",
      "4-5": "Entreviste ou pesquise uma profissão e organize: problema que resolve, conhecimentos usados, ferramentas e um mito sobre esse trabalho.",
      "6-8": "Compare duas profissões que atuam sobre o mesmo problema e explique como conhecimentos, responsabilidades e decisões são diferentes.",
    },
  },
  {
    slug: "livro-leitura",
    title: "Detetives de histórias",
    eyebrow: "Livro e leitura",
    description: "Leitura ativa para perceber pistas, pontos de vista, escolhas do autor e relações entre texto e imagem.",
    decorations: ["📚", "🔖", "🔎", "✍️", "📚"],
    fixedWindow: { start: 416, end: 420 },
    mission: {
      "1-3": "Escolha uma história curta, encontre começo, problema e solução e crie uma nova capa que dê uma pista sem contar o final.",
      "4-5": "Escolha um personagem e reúna três evidências do texto que mostrem como ele pensa, sente ou muda ao longo da história.",
      "6-8": "Compare como narrador, escolha de palavras e organização de cenas mudam a interpretação de um trecho literário.",
    },
  },
  {
    slug: "agua",
    title: "Missão cada gota conta",
    eyebrow: "Água e ciência",
    description: "Uma investigação curta sobre uso da água, medidas, ciclo e escolhas cotidianas.",
    decorations: ["💧", "🔬", "☁️", "🌱", "💧"],
    fixedWindow: { start: 320, end: 323 },
    mission: {
      "1-3": "Liste três usos da água no seu dia, escolha um para observar e desenhe uma forma de evitar desperdício.",
      "4-5": "Estime e depois meça, quando possível, quanto tempo uma torneira fica aberta em uma tarefa e proponha uma comparação mais econômica.",
      "6-8": "Crie uma pequena investigação com hipótese e dados sobre consumo ou qualidade da água e separe claramente observação de conclusão.",
    },
  },
];

function bahiaParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const value = (type: "year" | "month" | "day") => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function easterSundayUtc(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function localDateAsUtc(date: Date) {
  const { year, month, day } = bahiaParts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

function inFixedWindow(monthDay: number, start: number, end: number) {
  if (start <= end) return monthDay >= start && monthDay <= end;
  return monthDay >= start || monthDay <= end;
}

function isCarnival(date: Date) {
  const { year } = bahiaParts(date);
  const local = localDateAsUtc(date).getTime();
  const easter = easterSundayUtc(year);
  const start = addUtcDays(easter, -50).getTime();
  const end = addUtcDays(easter, -47).getTime();
  return local >= start && local <= end;
}

const carnival: SeasonalEvent = {
  slug: "carnaval",
  title: "Carnaval de ritmos, formas e histórias",
  eyebrow: "Carnaval",
  description: "Uma atividade cultural que usa música, matemática, linguagem e pesquisa sem estereotipar uma festa tão diversa.",
  decorations: ["🎭", "🎶", "✨", "🥁", "🎭"],
  mission: {
    "1-3": "Crie um padrão de formas e cores inspirado em uma fantasia e explique a sequência que você usou.",
    "4-5": "Pesquise uma manifestação de Carnaval de uma região brasileira, localize no mapa e explique duas características com suas fontes.",
    "6-8": "Compare duas manifestações carnavalescas brasileiras em origem, música, organização e contexto social usando fontes confiáveis.",
  },
};

export function getSeasonalEvent(date = new Date()): SeasonalEvent | null {
  if (isCarnival(date)) return carnival;
  const { month, day } = bahiaParts(date);
  const monthDay = month * 100 + day;
  return events.find((event) => event.fixedWindow && inFixedWindow(monthDay, event.fixedWindow.start, event.fixedWindow.end)) || null;
}

export function getGradeBand(gradeName?: string | null): SeasonalBand {
  const grade = Number(gradeName?.match(/\d+/)?.[0] || 0);
  if (grade >= 6) return "6-8";
  if (grade >= 4) return "4-5";
  return "1-3";
}

export function getSeasonalExperience(date = new Date(), gradeName?: string | null) {
  const event = getSeasonalEvent(date);
  if (!event) return null;
  const band = getGradeBand(gradeName);
  return {
    ...event,
    band,
    missionText: event.mission[band],
  };
}
