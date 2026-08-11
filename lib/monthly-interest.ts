function bahiaParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { year: get("year"), month: get("month"), day: Number(get("day") || 1) };
}

export function currentInterestMonth() {
  const { year, month } = bahiaParts();
  return `${year}-${month}-01`;
}

export async function shouldShowMonthlyInterest(supabase: any, userId: string, role: "teacher" | "guardian" | "student") {
  const { day } = bahiaParts();
  if (day < 3) return false;

  const { data } = await supabase
    .from("learning_interest_responses")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .eq("response_month", currentInterestMonth())
    .maybeSingle();
  return !data;
}
