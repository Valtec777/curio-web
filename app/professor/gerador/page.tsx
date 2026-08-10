import { redirect } from "next/navigation";

export default function LegacyTeacherGeneratorPage() {
  redirect("/professor/criar#gerar");
}
