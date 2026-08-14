export type PlanResourceKey = "meetings" | "family_meetings" | "missions" | "assessments" | "notebooks" | "materials" | "courses";

const resourceLabels: Record<PlanResourceKey, string> = {
  meetings: "aulas e revisões com o aluno",
  family_meetings: "encontros com a família",
  missions: "missões",
  assessments: "avaliações",
  notebooks: "atividades do Caderno",
  materials: "materiais",
  courses: "cursos do Modo Pensar",
};
export function planResourceLabel(value?: string | null) { return resourceLabels[value as PlanResourceKey] || value || "recurso"; }
export function planUsageTone(state?: string | null): "green" | "yellow" | "pink" | "blue" | "neutral" { if (state === "reached" || state === "blocked" || state === "paused") return "pink"; if (state === "warning") return "yellow"; if (state === "ok") return "green"; if (state === "unlimited") return "blue"; return "neutral"; }
export function planUsageStateLabel(state?: string | null) { if (state === "reached") return "Limite atingido"; if (state === "blocked") return "Não incluído"; if (state === "paused") return "Plano pausado"; if (state === "warning") return "Próximo do limite"; if (state === "ok") return "Disponível"; if (state === "unlimited") return "Sem limite definido"; return "A acompanhar"; }
function shortDate(value?: string | null) { if (!value) return "próximo ciclo"; const [year, month, day] = String(value).slice(0, 10).split("-"); return year && month && day ? `${day}/${month}/${year}` : String(value); }
export function planLimitErrorMessage(error: unknown) {
  const message = typeof error === "string" ? error : typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  const limit = message.match(/PLAN_LIMIT_REACHED\|([^|]+)\|(\d+)\|(\d+)\|([^\s|]+)/);
  if (limit) { const [, resource, used, max, renewsOn] = limit; return `Limite mensal de ${planResourceLabel(resource)} atingido. Este aluno já utilizou ${used}/${max} neste ciclo. Próxima renovação: ${shortDate(renewsOn)}.`; }
  const notIncluded = message.match(/PLAN_RESOURCE_NOT_INCLUDED\|([^|]+)\|/); if (notIncluded) return `O plano atual deste aluno não inclui ${planResourceLabel(notIncluded[1])}. O Admin pode revisar os limites em Planos.`;
  const paused = message.match(/PLAN_ACCESS_PAUSED\|([^|]+)\|/); if (paused) return `O plano deste aluno está pausado. Não é possível consumir ${planResourceLabel(paused[1])} até a situação da matrícula ser regularizada.`;
  return null;
}
