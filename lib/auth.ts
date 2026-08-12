import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "teacher" | "student" | "guardian";

export const getViewer = cache(async function getViewer() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  return {
    user,
    profile,
    roles: (roles ?? []).map((item) => item.role as AppRole),
  };
});

export async function requireUser() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireRole(role: AppRole) {
  const viewer = await requireUser();
  if (!viewer.roles.includes(role)) redirect("/dashboard");
  return viewer;
}
