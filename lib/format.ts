export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function domainLabel(level?: number | null) {
  const labels = [
    "Sem evidência suficiente",
    "Precisa de bastante apoio",
    "Em desenvolvimento",
    "Realiza sozinho",
    "Consolidado",
  ];
  return labels[level ?? 0] ?? labels[0];
}

export function autonomyLabel(level?: number | null) {
  const labels = [
    "Não avaliada",
    "Intervenção intensa",
    "Bastante apoio",
    "Apoio leve",
    "Independente",
  ];
  return labels[level ?? 0] ?? labels[0];
}

export function confidenceLabel(value?: string | null) {
  if (value === "high") return "Alta";
  if (value === "medium") return "Média";
  return "Baixa";
}

export function trendLabel(value?: string | null) {
  if (value === "improving") return "Melhorando";
  if (value === "attention") return "Precisa de atenção";
  return "Estável";
}
