import { notFound, redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/student";

export default async function LegacyStudentCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getCurrentStudent();
  const { data: course } = await supabase
    .from("free_courses")
    .select("slug")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!course?.slug) notFound();
  redirect(`/aluno/modo-pensar/${encodeURIComponent(course.slug)}`);
}
