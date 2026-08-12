"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentStudent } from "@/lib/student";

export async function chooseStudentAvatar(formData: FormData) {
  const parsed = z.string().uuid().safeParse(formData.get("characterId"));
  if (!parsed.success) {
    redirect(`/aluno/perfil?erro=${encodeURIComponent("Escolha um avatar válido.")}`);
  }

  const { student, supabase } = await getCurrentStudent();
  const { error } = await supabase.rpc("set_student_avatar", {
    p_student_id: student.id,
    p_character_id: parsed.data,
  });

  if (error) {
    console.error("Falha ao salvar avatar do aluno", error.code);
    redirect(`/aluno/perfil?erro=${encodeURIComponent("Não foi possível salvar seu avatar agora.")}`);
  }

  revalidatePath("/aluno/perfil");
  revalidatePath("/aluno");
  redirect(`/aluno/perfil?sucesso=${encodeURIComponent("Avatar salvo. Ele continuará no seu perfil nos próximos acessos.")}`);
}
