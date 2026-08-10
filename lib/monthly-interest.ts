export function currentInterestMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit" }).format(new Date()) + "-01";
}

export async function shouldShowMonthlyInterest(supabase: any, userId: string, role: "teacher" | "guardian" | "student") {
  const { data } = await supabase
    .from("learning_interest_responses")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .eq("response_month", currentInterestMonth())
    .maybeSingle();
  return !data;
}
